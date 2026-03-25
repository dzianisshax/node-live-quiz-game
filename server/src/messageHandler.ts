import { WebSocket } from "ws";
import { randomUUID } from "crypto";
import { users, games, connections } from "./store";
import {
  generateRoomCode,
  sendMsg,
  broadcastToGame,
  broadcastPlayerUpdate,
} from "./utils";
import { startQuestion, endQuestion } from "./gameLogic";
import {
  AnswerData,
  CreateGameData,
  JoinGameData,
  RegData,
  StartGameData,
  WSMessage,
} from "./types";

/**
 * Acts as a router, taking incoming parsed JSON messages and executing the correct commands.
 * @param {WebSocket} ws - Current socket.
 * @param {string} message - The incoming JSON string message from the client.
 */
export const handleMessage = (ws: WebSocket, message: string) => {
  try {
    const parsed: WSMessage = JSON.parse(message);
    const { type, data } = parsed;
    const userId = connections.get(ws);

    switch (type) {
      case "reg": {
        const regData = data as RegData;
        let currentUserId: string;

        // Check if user already exists
        const existingUser = Array.from(users.values()).find(
          (u) => u.name === regData.name,
        );

        if (existingUser) {
          if (existingUser.password === regData.password) {
            // Login successful
            currentUserId = existingUser.index;
            // Update to the new socket connection
            existingUser.ws = ws;
          } else {
            // Login failed
            sendMsg(ws, "reg", {
              name: regData.name,
              index: "",
              error: true,
              errorText: "Invalid password",
            });
            return;
          }
        } else {
          // Register new user
          currentUserId = randomUUID();
          users.set(currentUserId, {
            name: regData.name,
            password: regData.password,
            index: currentUserId,
            ws,
          });
        }

        connections.set(ws, currentUserId);
        sendMsg(ws, "reg", {
          name: regData.name,
          index: currentUserId,
          error: false,
          errorText: "",
        });
        break;
      }

      case "create_game": {
        if (!userId) return;
        const createData = data as CreateGameData;
        const gameId = randomUUID();
        const code = generateRoomCode();

        games.set(gameId, {
          id: gameId,
          code,
          hostId: userId,
          hostWs: ws,
          questions: createData.questions,
          players: [],
          currentQuestion: -1,
          status: "waiting",
          playerAnswers: new Map(),
        });

        sendMsg(ws, "game_created", { gameId, code });
        break;
      }

      case "join_game": {
        if (!userId) return;
        const joinData = data as JoinGameData;
        const game = Array.from(games.values()).find(
          (g) => g.code === joinData.code && g.status === "waiting",
        );
        const user = users.get(userId);

        if (game && user) {
          // Only add them if they aren't already in the game
          if (!game.players.some((p) => p.index === user.index)) {
            // Extend User into Player
            game.players.push({ ...user, score: 0 });
          }

          sendMsg(ws, "game_joined", { gameId: game.id });
          broadcastToGame(game, "player_joined", {
            playerName: user.name,
            playerCount: game.players.length,
          });
          broadcastPlayerUpdate(game);
        }
        break;
      }

      case "start_game": {
        const startData = data as StartGameData;
        const game = games.get(startData.gameId);
        if (game && game.hostId === userId && game.status === "waiting") {
          game.status = "in_progress";
          game.currentQuestion = 0;
          startQuestion(game);
        }
        break;
      }

      case "answer": {
        if (!userId) return;
        const answerData = data as AnswerData;
        const game = games.get(answerData.gameId);
        if (
          game &&
          game.status === "in_progress" &&
          game.currentQuestion === answerData.questionIndex
        ) {
          const timestamp = Date.now() - (game.questionStartTime || 0);

          if (!game.playerAnswers.has(userId)) {
            game.playerAnswers.set(userId, {
              answerIndex: answerData.answerIndex,
              timestamp,
            });
            sendMsg(ws, "answer_accepted", {
              questionIndex: answerData.questionIndex,
            });

            if (game.playerAnswers.size === game.players.length) {
              endQuestion(game);
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Invalid message format:", err);
  }
};

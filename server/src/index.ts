import { WebSocketServer } from "ws";
import { handleMessage } from "./messageHandler";
import { users, games, connections } from "./store";
import { broadcastPlayerUpdate } from "./utils";
import { endQuestion } from "./gameLogic";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    handleMessage(ws, message.toString());
  });

  ws.on("close", () => {
    const userId = connections.get(ws);
    if (userId) {
      connections.delete(ws);

      // Remove disconnected player from active or waiting games
      games.forEach((game) => {
        if (game.status === "waiting" || game.status === "in_progress") {
          const initialLen = game.players.length;
          game.players = game.players.filter((p) => p.index !== userId);

          if (game.players.length < initialLen) {
            broadcastPlayerUpdate(game);

            // If we are waiting for answers and someone drops, trigger endQuestion if everyone else has answered
            if (
              game.status === "in_progress" &&
              game.playerAnswers.size === game.players.length &&
              game.players.length > 0
            ) {
              endQuestion(game);
            }
          }
        }
      });

      // Keep the user in the `users` Map so they can log back in later, but remove their WS reference
      const user = users.get(userId);
      if (user) user.ws = undefined;
    }
  });
});

console.log(`Live Quiz Game Server is running!`);
console.log(`WebSocket Address: ws://localhost:${PORT}`);

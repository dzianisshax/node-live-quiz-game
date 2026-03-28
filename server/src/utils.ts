import { WebSocket } from "ws";
import { randomBytes } from "crypto";
import { Game } from "./types";

/**
 * Generates a random 6-character uppercase alphanumeric room code.
 * @returns {string} The generated room code.
 */
export const generateRoomCode = (): string => {
  return randomBytes(3).toString("hex").toUpperCase();
};

/**
 * Sends a formatted JSON message to a specific WebSocket client.
 * @param {WebSocket} ws - The target WebSocket connection.
 * @param {string} type - The type of the command/message.
 * @param {any} data - The payload data to send.
 */
export const sendMsg = (ws: WebSocket, type: string, data: any) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, id: 0 }));
  }
};

/**
 * Broadcasts a formatted JSON message to all players in a game.
 * @param {Game} game - The game instance containing the players and host.
 * @param {string} type - The type of the command/message.
 * @param {any} data - The payload data to broadcast.
 * @param {boolean} [includeHost=true] - Whether to send the broadcast to the host as well.
 */
export const broadcastToGame = (
  game: Game,
  type: string,
  data: any,
  includeHost = true,
) => {
  const payload = JSON.stringify({ type, data, id: 0 });

  game.players.forEach((p) => {
    if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(payload);
  });

  if (includeHost && game.hostWs.readyState === WebSocket.OPEN) {
    game.hostWs.send(payload);
  }
};

/**
 * Broadcasts the updated list of players and their scores to everyone in the game room.
 * @param {Game} game - The game instance to broadcast the update for.
 */
export const broadcastPlayerUpdate = (game: Game) => {
  const payload = game.players.map((p) => ({
    name: p.name,
    index: p.index,
    score: p.score,
  }));
  broadcastToGame(game, "update_players", payload);
};

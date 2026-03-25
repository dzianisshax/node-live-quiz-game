import { WebSocket } from "ws";
import { User, Game } from "./types";

// Simple in-memory database

export const users = new Map<string, User>();
export const games = new Map<string, Game>();
// Maps WS to Player ID
export const connections = new Map<WebSocket, string>();

import type { FastifyInstance } from "fastify";
import { attachSocket, getRecentEvents } from "./hub.js";

export async function realtimeRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    attachSocket(socket);
  });

  app.get("/api/realtime/events", async () => ({ events: getRecentEvents() }));
}

import { attachSocket, getRecentEvents } from "./hub.js";
export async function realtimeRoutes(app) {
    app.get("/ws", { websocket: true }, (socket) => {
        attachSocket(socket);
    });
    app.get("/api/realtime/events", async () => ({ events: getRecentEvents() }));
}

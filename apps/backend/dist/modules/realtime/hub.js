const sockets = new Set();
const recentEvents = [];
const MAX_EVENTS = 200;
export function attachSocket(socket) {
    sockets.add(socket);
    socket.send(JSON.stringify({ type: "system.connected", createdAt: new Date().toISOString(), payload: { recentEvents } }));
    socket.on("close", () => sockets.delete(socket));
}
export function broadcast(type, payload, serverId) {
    const event = { type, payload, serverId, createdAt: new Date().toISOString() };
    recentEvents.unshift(event);
    recentEvents.splice(MAX_EVENTS);
    const raw = JSON.stringify(event);
    for (const socket of sockets) {
        try {
            socket.send(raw);
        }
        catch {
            sockets.delete(socket);
        }
    }
    return event;
}
export function getRecentEvents() {
    return recentEvents;
}

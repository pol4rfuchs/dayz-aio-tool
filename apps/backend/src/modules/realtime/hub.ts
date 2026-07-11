export type RealtimeEvent = {
  type: string;
  serverId?: string;
  payload?: unknown;
  createdAt: string;
};

type ManagedSocket = { send: (data: string) => void; on: (event: "close", handler: () => void) => void };
const sockets = new Set<ManagedSocket>();
const recentEvents: RealtimeEvent[] = [];
const MAX_EVENTS = 200;

export function attachSocket(socket: ManagedSocket) {
  sockets.add(socket);
  socket.send(JSON.stringify({ type: "system.connected", createdAt: new Date().toISOString(), payload: { recentEvents } }));
  socket.on("close", () => sockets.delete(socket));
}

export function broadcast(type: string, payload?: unknown, serverId?: string) {
  const event: RealtimeEvent = { type, payload, serverId, createdAt: new Date().toISOString() };
  recentEvents.unshift(event);
  recentEvents.splice(MAX_EVENTS);
  const raw = JSON.stringify(event);
  for (const socket of sockets) {
    try { socket.send(raw); } catch { sockets.delete(socket); }
  }
  return event;
}

export function getRecentEvents() {
  return recentEvents;
}

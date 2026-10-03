import { useEffect, useRef } from "react";
import { getWebSocketUrl } from "./api";

export type RealtimeMessage = { type: string; serverId?: string; payload?: any; createdAt: string };

/**
 * Subscribes to the backend WebSocket and reconnects with exponential backoff
 * (1s, 2s, 4s ... max 30s). The handler may change on every render; the latest one is always used.
 */
export function useRealtime(onMessage: (message: RealtimeMessage) => void) {
  const handlerRef = useRef(onMessage);
  useEffect(() => { handlerRef.current = onMessage; });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(getWebSocketUrl());
      socket.onopen = () => { attempt = 0; };
      socket.onmessage = (event) => {
        try { handlerRef.current(JSON.parse(event.data) as RealtimeMessage); }
        catch { /* ignore malformed frames */ }
      };
      socket.onclose = () => {
        if (disposed) return;
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);
}

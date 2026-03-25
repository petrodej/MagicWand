import { useEffect, useRef } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  enabled?: boolean;
}

export function useWebSocket({ url, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let backoff = 1000;
    let alive = true;

    function connect() {
      if (!alive) return;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (alive) {
          reconnectTimeout = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [url, enabled]);

  return wsRef;
}

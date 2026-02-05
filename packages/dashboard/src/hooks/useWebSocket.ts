import { useState, useEffect, useRef, useCallback } from 'react';
import WebSocket from 'ws';
import type { WsMessage } from '../types.js';

export interface UseWebSocketResult {
  connected: boolean;
  lastMessage: WsMessage | null;
  error: string | null;
  reconnectAttempts: number;
  reconnect: () => void;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(url: string): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.on('open', () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        setReconnectAttempts(0);
      });

      ws.on('message', (data: WebSocket.RawData) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(data.toString()) as WsMessage;
          setLastMessage(message);
        } catch {
          // Ignore non-JSON messages
        }
      });

      ws.on('close', () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        // Schedule reconnect if under max attempts
        setReconnectAttempts((prev) => {
          const next = prev + 1;
          if (next <= MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, RECONNECT_DELAY_MS);
          } else {
            setError(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
          }
          return next;
        });
      });

      ws.on('error', (err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [url]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setReconnectAttempts(0);
    setConnected(false);
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, lastMessage, error, reconnectAttempts, reconnect };
}

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { HUB_WS_URL } from '@/lib/config';
import type { WsMessage } from '@/lib/types';

type MessageHandler = (message: WsMessage) => void;

interface WebSocketContextValue {
  isConnected: boolean;
  lastMessage: WsMessage | null;
  subscribe: (handler: MessageHandler) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  lastMessage: null,
  subscribe: () => () => {},
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
  address?: string;
  url?: string;
}

export function WebSocketProvider({
  children,
  address,
  url = HUB_WS_URL,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to messages
  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!address) return;

    // Guard against orphaned reconnects from StrictMode double-mount.
    // When the cleanup function runs, it sets this flag *before* calling
    // ws.close(), so the onclose handler knows not to schedule a reconnect.
    let intentionalClose = false;

    const connect = () => {
      const wsUrl = `${url}?address=${address}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!intentionalClose) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          setLastMessage(message);
          // Notify all subscribers
          handlersRef.current.forEach((handler) => handler(message));
        } catch {
          // Ignore parse errors
        }
      };
    };

    connect();

    // Cleanup on unmount or address change
    return () => {
      intentionalClose = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [address, url]);

  const value: WebSocketContextValue = {
    isConnected,
    lastMessage,
    subscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

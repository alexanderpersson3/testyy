import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketContextType {
  isConnected: boolean;
  send: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isEnabled] = useState(() => import.meta.env.VITE_WS_ENABLED === 'true');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectAttemptRef = useRef(0);

  const connect = useCallback(() => {
    if (!isEnabled) return;

    try {
      const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3001');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          ws.close();
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      scheduleReconnect();
    }
  }, [isEnabled]);

  const scheduleReconnect = () => {
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptRef.current += 1;
      console.log(`Attempting to reconnect (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
      connect();
    }, Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000));
  };

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const value = {
    isConnected,
    send: useCallback((message: any) => {
      if (!isEnabled) {
        console.warn('WebSocket is disabled');
        return;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('WebSocket is not connected. Message not sent:', message);
      }
    }, [isEnabled]),
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
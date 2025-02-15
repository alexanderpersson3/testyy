import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

interface ServerStatus {
  http: boolean;
  websocket: boolean;
  recipeService: boolean;
  lastChecked: Date | null;
}

interface ConnectionContextType {
  serverStatus: ServerStatus;
  checkConnections: () => Promise<ServerStatus>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    http: false,
    websocket: false,
    recipeService: false,
    lastChecked: null
  });

  const checkConnections = useCallback(async () => {
    const status = {
      http: false,
      websocket: false,
      recipeService: false,
      lastChecked: new Date()
    };

    try {
      // Check HTTP
      const httpResponse = await fetch('http://localhost:3001/health');
      status.http = httpResponse.status === 200;

      // Check WebSocket
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          status.websocket = true;
          ws.close();
          resolve(true);
        };
        ws.onerror = () => {
          status.websocket = false;
          resolve(false);
        };
        setTimeout(() => resolve(false), 3000); // Timeout after 3s
      });

      // Check Recipe Service
      const recipeResponse = await fetch('http://localhost:3001/api/recipes/health');
      status.recipeService = recipeResponse.status === 200;
    } catch (err) {
      console.error('Server connection check failed:', err);
    }

    setServerStatus(status);
    return status;
  }, []);

  useEffect(() => {
    checkConnections();
    const intervalId = setInterval(checkConnections, 30000);
    return () => clearInterval(intervalId);
  }, [checkConnections]);

  return (
    <ConnectionContext.Provider value={{ serverStatus, checkConnections }}>
      {children}
    </ConnectionContext.Provider>
  );
};

// Custom hook for easy server status checking
export const useServerStatus = () => {
  const { serverStatus, checkConnections } = useConnection();

  const isFullyConnected = serverStatus.http && serverStatus.websocket && serverStatus.recipeService;
  const lastChecked = serverStatus.lastChecked;

  return {
    isFullyConnected,
    httpConnected: serverStatus.http,
    websocketConnected: serverStatus.websocket,
    recipeServiceConnected: serverStatus.recipeService,
    lastChecked,
    checkConnections,
  };
};

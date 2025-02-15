import { EventEmitter } from 'events';
import { authService } from './auth.service';
import { ObjectId } from 'bson';

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface WebSocketConfig {
  url: string;
  token: string;
  deviceType: 'web' | 'mobile';
  deviceId: string;
}

interface WebSocketError {
  code: string;
  message: string;
  details?: any;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private readonly eventEmitter = new EventEmitter();
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectInterval = 3000;
  private isConnecting = false;
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectedClients: { total: number; web: number; mobile: number } = {
    total: 0,
    web: 0,
    mobile: 0
  };
  private channelSubscribers: Map<string, Set<string>> = new Map();

  private constructor() {
    console.log('WebSocketService initialized');
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(config: WebSocketConfig): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = new URL(config.url);
    wsUrl.searchParams.append('token', config.token);
    wsUrl.searchParams.append('deviceType', config.deviceType);
    wsUrl.searchParams.append('deviceId', config.deviceId);

    const redactedUrl = wsUrl.toString().replace(/token=([^&]+)/, 'token=REDACTED');
    console.log('Connecting to WebSocket with URL:', redactedUrl);

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.ws = new WebSocket(wsUrl.toString());
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
    };

    this.ws.onclose = async (event) => {
      const closeInfo = {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      };
      console.log('WebSocket connection closed:', closeInfo);
      
      this.isConnected = false;
      this.isConnecting = false;
      this.eventEmitter.emit('disconnected');
      
      if (event.code === 1008) {
        await this.handleAuthError({
          code: 'AUTH_ERROR',
          message: event.reason || 'Authentication failed',
          details: closeInfo
        });
        return;
      }
      
      await this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.eventEmitter.emit('error', { 
        code: 'WEBSOCKET_ERROR',
        message: 'WebSocket connection error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.eventEmitter.emit('error', { 
          code: 'MESSAGE_PARSE_ERROR', 
          message: 'Failed to parse WebSocket message',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    };
  }

  private handleAuthError(error: WebSocketError): void {
    console.log('WebSocket authentication failed, attempting token refresh');
    this.eventEmitter.emit('authError', error);
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.eventEmitter.emit('maxReconnectAttemptsReached');
      return;
    }

    const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect({
        url: import.meta.env.VITE_WS_URL,
        token: localStorage.getItem('token') || '',
        deviceType: 'web',
        deviceId: localStorage.getItem('deviceId') || 'unknown',
      });
    }, backoffTime);
  }

  private handleMessage(message: WebSocketMessage): void {
    const subscribers = this.subscriptions.get(message.type);
    if (subscribers) {
      subscribers.forEach(callback => callback(message.payload));
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  public send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  public subscribe<T>(type: string, callback: (data: T) => void): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    this.subscriptions.get(type)!.add(callback);

    return () => {
      const subscribers = this.subscriptions.get(type);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    };
  }

  public disconnect(): void {
    console.log('Disconnecting WebSocket');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.messageQueue = [];
    this.subscriptions.clear();
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  public attachToServer(server: any): void {
    // Implementation for server attachment
    console.log('WebSocketService initialized');
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public broadcast(type: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  public emitToUser(userId: ObjectId, eventType: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'user-event',
        userId: userId.toString(),
        eventType,
        payload
      }));
    }
  }

  public getConnectedClientsCount(): { total: number; web: number; mobile: number } {
    return this.connectedClients;
  }

  public getChannelSubscribersCount(channel: string): number {
    return this.channelSubscribers.get(channel)?.size || 0;
  }
}

export const initializeWebSocket = (config: WebSocketConfig): WebSocketService => {
  const service = WebSocketService.getInstance();
  service.connect(config);
  return service;
};

export const wsService = WebSocketService.getInstance();
export default wsService;
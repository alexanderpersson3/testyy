import { WebSocket } from 'ws';

export interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId?: string;
  sessionId?: string;
  close(code?: number, data?: string | Buffer): void;
  on(event: 'message', cb: (data: Buffer) => void): this;
  on(event: 'close', cb: () => void): this;
  on(event: 'pong', cb: () => void): this;
  send(data: string | Buffer): void;
  ping(): void;
  terminate(): void;
  readyState: number;
}

export interface WebSocketMessage {
  type: 'ping' | 'pong' | 'message' | 'notification';
  payload?: any;
  timestamp?: number;
}

export interface WebSocketError {
  code: number;
  message: string;
} 
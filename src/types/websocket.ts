import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export interface WebSocketClient extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
  on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'upgrade', listener: (request: IncomingMessage) => void): this;
  on(event: 'message', listener: (data: Buffer) => void): this;
  on(event: 'open', listener: () => void): this;
  on(event: 'ping', listener: (data: Buffer) => void): this;
  on(event: 'pong', listener: (data: Buffer) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
} 

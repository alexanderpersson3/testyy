import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ObjectId } from 'mongodb';
import { UserRole } from '../auth.js';
/**
 * WebSocket client interface
 */
export interface WebSocketClient extends WebSocket {
    userId?: ObjectId;
    sessionId?: string;
    isAlive: boolean;
    room?: string;
    subscriptions: Set<string>;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'upgrade', listener: (request: IncomingMessage) => void): this;
    on(event: 'message', listener: (data: Buffer) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    send(data: string | Buffer): void;
    ping(): void;
    terminate(): void;
    close(code?: number, data?: string | Buffer): void;
    readyState: WebSocket['readyState'];
}
/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'auth' | 'auth_success' | 'subscribe' | 'subscribed' | 'unsubscribe' | 'unsubscribed' | 'message' | 'error';
/**
 * Base WebSocket message interface
 */
export interface BaseWebSocketMessage {
    type: WebSocketMessageType;
    timestamp: number;
}
/**
 * Authentication message
 */
export interface AuthMessage extends BaseWebSocketMessage {
    type: 'auth' | 'auth_success';
    data: {
        userId: string;
        role?: UserRole;
    };
}
/**
 * Subscription message
 */
export interface SubscriptionMessage extends BaseWebSocketMessage {
    type: 'subscribe' | 'subscribed' | 'unsubscribe' | 'unsubscribed';
    channel: string;
}
/**
 * Data message
 */
export interface DataMessage extends BaseWebSocketMessage {
    type: 'message';
    channel?: string;
    data: any;
}
/**
 * Error message
 */
export interface ErrorMessage extends BaseWebSocketMessage {
    type: 'error';
    error: {
        code: string;
        message: string;
    };
}
/**
 * Union type of all WebSocket messages
 */
export type WebSocketMessage = AuthMessage | SubscriptionMessage | DataMessage | ErrorMessage;
/**
 * WebSocket event interface
 */
export interface WebSocketEvent {
    event: string;
    data: any;
}
/**
 * WebSocket room interface
 */
export interface WebSocketRoom {
    id: string;
    clients: Set<WebSocketClient>;
    metadata?: Record<string, any>;
}
/**
 * Type guard for WebSocket messages
 */
export declare function isWebSocketMessage(message: any): message is WebSocketMessage;
/**
 * Type guard for specific message types
 */
export declare function isAuthMessage(message: WebSocketMessage): message is AuthMessage;
export declare function isSubscriptionMessage(message: WebSocketMessage): message is SubscriptionMessage;
export declare function isDataMessage(message: WebSocketMessage): message is DataMessage;
export declare function isErrorMessage(message: WebSocketMessage): message is ErrorMessage;

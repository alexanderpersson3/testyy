import { WebSocket } from 'ws';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
interface WebSocketConnection extends WebSocket {
    userId: ObjectId;
    subscriptions: Set<string>;
    deviceType: 'web' | 'mobile';
    deviceId: string;
    lastPing: number;
}
export declare class WebSocketService {
    private static instance;
    private wss;
    private clients;
    private pingInterval;
    private constructor();
    static getInstance(server?: Server): WebSocketService;
    private setupWebSocket;
    private setupClientHandlers;
    private checkConnections;
    private handleClientMessage;
    /**
     * Send message to a specific client
     */
    private send;
    /**
     * Send error message to a client
     */
    private sendError;
    /**
     * Emit event to a specific user across all their devices
     */
    emitToUser(userId: ObjectId, type: string, payload: any): void;
    /**
     * Emit event to all subscribers of a topic
     */
    emitToTopic(topic: string, type: string, payload: any): void;
    /**
     * Emit event to all clients of a specific type
     */
    emitToDeviceType(deviceType: WebSocketConnection['deviceType'], type: string, payload: any): void;
    /**
     * Broadcast event to all connected clients
     */
    broadcast(type: string, payload: any): void;
    /**
     * Get number of connected clients
     */
    getConnectedClientsCount(): {
        total: number;
        web: number;
        mobile: number;
    };
    /**
     * Clean up resources
     */
    cleanup(): void;
}
export {};

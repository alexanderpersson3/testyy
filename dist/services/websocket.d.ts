import { Server } from 'http';
import { ObjectId } from 'mongodb';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
declare class WebSocketService {
    private static instance;
    private wss;
    private clients;
    private pingInterval;
    private constructor();
    static getInstance(): WebSocketService;
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
    private setupWebSocketServer;
    private startHeartbeat;
    private handleMessage;
    broadcast(type: string, payload: any): void;
    emitToUser(userId: ObjectId, type: string, payload: any): void;
    close(): void;
    getConnectedClientsCount(): {
        total: number;
        web: number;
        mobile: number;
    };
    getChannelSubscribersCount(channel: string): number;
}
export declare function initializeWebSocket(server: Server): void;
export declare function getWebSocketService(): WebSocketService;
export {};

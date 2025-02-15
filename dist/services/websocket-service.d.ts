import { Server } from 'http';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { ObjectId } from 'mongodb';
declare class WebSocketService {
    private static instance;
    private wss;
    private clients;
    private pingInterval;
    private constructor();
    static getInstance(): WebSocketService;
    getConnectedClientsCount(): number;
    getChannelSubscribersCount(channel: string): number;
    attachToServer(server: Server): void;
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
    private setupWebSocketServer;
    private startHeartbeat;
    broadcast(type: string, payload: any): void;
    emitToUser(userId: string | ObjectId, type: string, payload: any): void;
    notifyListUpdate(listId: string | ObjectId, type: string, data: any): void;
    close(): void;
}
export { WebSocketService };

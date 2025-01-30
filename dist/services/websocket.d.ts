import { WebSocket } from 'ws';
import { ObjectId } from 'mongodb';
interface WebSocketClient extends WebSocket {
    isAlive: boolean;
    userId: string;
    subscriptions: Set<string>;
}
export declare class WebSocketService {
    private wss;
    private clients;
    private pingInterval;
    constructor(server: any, path: string);
    private setupWebSocketServer;
    private ping;
    protected handleMessage(client: WebSocketClient, message: Buffer): void;
    protected broadcast(message: string, filter?: (client: WebSocketClient) => boolean): void;
    close(): void;
    notifyListUpdate(listId: ObjectId, updateType: string, data: any): void;
    notifyItemUpdate(listId: ObjectId, updateType: string, data: any): void;
}
export declare function initializeWebSocket(server: any, path: string): void;
export declare function getWebSocketService(): WebSocketService;
export {};
//# sourceMappingURL=websocket.d.ts.map
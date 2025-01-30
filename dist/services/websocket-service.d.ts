import { Server as HttpServer } from 'http';
export declare class WebSocketService {
    private wss;
    private clients;
    private pingInterval;
    private isReady;
    constructor(server: HttpServer);
    private setupWebSocket;
    waitForReady(timeout?: number): Promise<void>;
    private ping;
    private handleMessage;
    broadcast(message: string | Buffer, excludeClient?: string): void;
    sendToUser(userId: string, message: string | Buffer): void;
    close(): Promise<void>;
}
//# sourceMappingURL=websocket-service.d.ts.map
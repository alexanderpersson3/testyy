import { WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
export class WebSocketService {
    constructor(server, path) {
        this.clients = new Set();
        this.wss = new WebSocketServer({ server, path });
        this.setupWebSocketServer();
        this.pingInterval = setInterval(() => this.ping(), 30000);
    }
    setupWebSocketServer() {
        this.wss.on('connection', async (ws, request) => {
            const client = ws;
            client.isAlive = true;
            client.subscriptions = new Set();
            try {
                const url = new URL(request.url, `http://${request.headers.host}`);
                const token = url.searchParams.get('token');
                if (!token) {
                    client.close(1008, 'Authentication required');
                    return;
                }
                const decoded = verify(token, process.env.JWT_SECRET);
                client.userId = decoded.id;
                this.clients.add(client);
                client.on('pong', () => {
                    client.isAlive = true;
                });
                client.on('message', (message) => {
                    this.handleMessage(client, message);
                });
                client.on('close', () => {
                    this.clients.delete(client);
                });
            }
            catch (error) {
                console.error('WebSocket connection error:', error);
                client.close(1008, 'Invalid token');
            }
        });
    }
    ping() {
        this.clients.forEach(client => {
            if (!client.isAlive) {
                client.terminate();
                this.clients.delete(client);
                return;
            }
            client.isAlive = false;
            client.ping();
        });
    }
    handleMessage(client, message) {
        try {
            const data = JSON.parse(message.toString());
            client.send(JSON.stringify({ type: 'pong' }));
        }
        catch (error) {
            console.error('Error handling message:', error);
        }
    }
    broadcast(message, filter) {
        this.clients.forEach(client => {
            if (!filter || filter(client)) {
                client.send(message);
            }
        });
    }
    close() {
        clearInterval(this.pingInterval);
        this.wss.close();
    }
    notifyListUpdate(listId, updateType, data) {
        const message = JSON.stringify({
            type: 'listUpdate',
            listId: listId.toString(),
            updateType,
            data
        });
        this.clients.forEach(client => {
            if (client.subscriptions.has(listId.toString())) {
                client.send(message);
            }
        });
    }
    notifyItemUpdate(listId, updateType, data) {
        const message = JSON.stringify({
            type: 'itemUpdate',
            listId: listId.toString(),
            updateType,
            data
        });
        this.clients.forEach(client => {
            if (client.subscriptions.has(listId.toString())) {
                client.send(message);
            }
        });
    }
}
let wsService;
export function initializeWebSocket(server, path) {
    wsService = new WebSocketService(server, path);
}
export function getWebSocketService() {
    if (!wsService) {
        throw new Error('WebSocket service not initialized');
    }
    return wsService;
}
//# sourceMappingURL=websocket.js.map
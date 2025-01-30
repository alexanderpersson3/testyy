import { WebSocket, WebSocketServer } from 'ws';
import { verifyToken } from '../utils/auth.js';
export class WebSocketService {
    constructor(server) {
        this.isReady = false;
        this.wss = new WebSocketServer({
            server,
            clientTracking: true,
            handleProtocols: () => 'websocket'
        });
        this.clients = new Map();
        this.setupWebSocket();
        this.pingInterval = setInterval(() => this.ping(), 30000);
        this.pingInterval.unref(); // Allow the process to exit even if the interval is still running
    }
    setupWebSocket() {
        this.wss.on('connection', async (ws, req) => {
            console.log('New WebSocket connection attempt');
            const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
            const token = urlParams.searchParams.get('token');
            if (!token) {
                console.log('Rejecting connection: No token provided');
                ws.close(1008, 'Authentication required');
                return;
            }
            try {
                const decoded = verifyToken(token);
                ws.userId = decoded.id;
                ws.sessionId = req.headers['sec-websocket-key'];
                ws.isAlive = true;
                this.clients.set(ws.sessionId, ws);
                console.log(`Client authenticated: ${ws.userId}`);
                ws.on('pong', () => {
                    ws.isAlive = true;
                });
                ws.on('message', (message) => {
                    console.log(`Received message from ${ws.userId}:`, message.toString());
                    this.handleMessage(ws, message);
                });
                ws.on('close', () => {
                    console.log(`Client disconnected: ${ws.userId}`);
                    this.clients.delete(ws.sessionId);
                });
                ws.on('error', (error) => {
                    console.error(`WebSocket error for client ${ws.userId}:`, error);
                    this.clients.delete(ws.sessionId);
                    ws.terminate();
                });
            }
            catch (error) {
                console.log('Rejecting connection: Invalid token');
                ws.close(1008, 'Invalid token');
            }
        });
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
        this.wss.on('listening', () => {
            console.log('WebSocket server is ready');
            this.isReady = true;
        });
        this.wss.on('close', () => {
            console.log('WebSocket server closed');
            this.isReady = false;
        });
    }
    async waitForReady(timeout = 5000) {
        if (this.isReady) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkInterval);
                    resolve();
                }
                else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('WebSocket server failed to become ready'));
                }
            }, 100);
        });
    }
    ping() {
        this.clients.forEach((client) => {
            if (!client.isAlive) {
                console.log(`Terminating inactive client: ${client.userId}`);
                client.terminate();
                return;
            }
            client.isAlive = false;
            try {
                client.ping();
            }
            catch (error) {
                console.error(`Error pinging client ${client.userId}:`, error);
                client.terminate();
            }
        });
    }
    handleMessage(client, message) {
        try {
            const data = JSON.parse(message.toString());
            console.log('Handling message:', data);
            switch (data.type) {
                case 'ping':
                    console.log('Sending pong response');
                    client.send(JSON.stringify({ type: 'pong' }));
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
                    client.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        }
        catch (error) {
            console.error('Error handling WebSocket message:', error);
            client.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    }
    broadcast(message, excludeClient) {
        this.clients.forEach((client, sessionId) => {
            if (sessionId !== excludeClient && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    console.error(`Error broadcasting to client ${client.userId}:`, error);
                }
            }
        });
    }
    sendToUser(userId, message) {
        this.clients.forEach((client) => {
            if (client.userId === userId && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    console.error(`Error sending message to client ${client.userId}:`, error);
                }
            }
        });
    }
    close() {
        clearInterval(this.pingInterval);
        return new Promise((resolve) => {
            // Close all client connections
            this.clients.forEach((client) => {
                try {
                    client.terminate();
                }
                catch (error) {
                    // Ignore errors during cleanup
                }
            });
            this.clients.clear();
            // Close the server
            this.wss.close(() => {
                console.log('WebSocket server closed');
                resolve();
            });
        });
    }
}
//# sourceMappingURL=websocket-service.js.map
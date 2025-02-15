import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { ObjectId } from 'mongodb';
;
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import logger from '../utils/logger.js';
class WebSocketService {
    constructor() {
        this.wss = new WebSocketServer({ noServer: true });
        this.clients = new Map();
        this.setupWebSocketServer();
        this.pingInterval = this.startHeartbeat();
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    getConnectedClientsCount() {
        return this.clients.size;
    }
    getChannelSubscribersCount(channel) {
        let count = 0;
        this.clients.forEach(client => {
            if (client.subscriptions.has(channel)) {
                count++;
            }
        });
        return count;
    }
    attachToServer(server) {
        server.on('upgrade', this.handleUpgrade.bind(this));
    }
    handleUpgrade(request, socket, head) {
        const { pathname } = new URL(request.url || '', `ws://${request.headers.host}`);
        if (pathname === '/ws' || pathname === '/') {
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        }
        else {
            socket.destroy();
        }
    }
    setupWebSocketServer() {
        this.wss.on('connection', async (ws, req) => {
            try {
                const token = new URL(req.url || '', 'ws://localhost').searchParams.get('token');
                if (!token) {
                    ws.close(1008, 'Authentication required');
                    return;
                }
                const decoded = jwt.verify(token, config.jwt.secret);
                const wsWithId = ws;
                wsWithId.userId = new ObjectId(decoded.userId);
                wsWithId.isAlive = true;
                wsWithId.subscriptions = new Set();
                wsWithId.on('pong', () => {
                    wsWithId.isAlive = true;
                });
                wsWithId.on('close', () => {
                    if (wsWithId.userId) {
                        this.clients.delete(wsWithId.userId.toString());
                    }
                });
                this.clients.set(wsWithId.userId.toString(), wsWithId);
            }
            catch (error) {
                logger.error('WebSocket connection error:', error);
                ws.close(1008, 'Invalid token');
            }
        });
    }
    startHeartbeat(interval = 30000) {
        return setInterval(() => {
            this.clients.forEach((client) => {
                if (!client.isAlive) {
                    client.terminate();
                    return;
                }
                client.isAlive = false;
                client.ping();
            });
        }, interval);
    }
    broadcast(type, payload) {
        const message = JSON.stringify({ type, payload });
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    emitToUser(userId, type, payload) {
        const userIdStr = typeof userId === 'string' ? userId : userId.toString();
        const client = this.clients.get(userIdStr);
        if (client?.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
        }
    }
    notifyListUpdate(listId, type, data) {
        const message = JSON.stringify({
            type: 'listUpdate',
            listId: listId.toString(),
            updateType: type,
            data,
        });
        this.clients.forEach(client => {
            if (client.subscriptions.has(listId.toString()) && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    close() {
        clearInterval(this.pingInterval);
        this.clients.forEach(client => {
            try {
                client.terminate();
            }
            catch (error) {
                logger.error('Error closing client:', error);
            }
        });
        this.wss.close();
    }
}
WebSocketService.instance = null;
export { WebSocketService };
//# sourceMappingURL=websocket-service.js.map
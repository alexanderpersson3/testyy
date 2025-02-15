import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { config } from '../config.js';
import { ObjectId } from 'mongodb';
;
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
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
    handleUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
        });
    }
    setupWebSocketServer() {
        this.wss.on('connection', async (ws, req) => {
            try {
                // Extract token from query string
                const token = new URL(req.url || '', 'ws://localhost').searchParams.get('token');
                if (!token) {
                    ws.close(1008, 'Authentication required');
                    return;
                }
                // Verify token
                const decoded = jwt.verify(token, config.jwt.secret);
                const wsWithId = ws;
                wsWithId.userId = new ObjectId(decoded.userId);
                wsWithId.isAlive = true;
                wsWithId.subscriptions = new Set();
                // Handle device ID - ensure it's a string
                const deviceId = req.headers['device-id'];
                wsWithId.deviceId = Array.isArray(deviceId) ? deviceId[0] : deviceId;
                // Set up ping/pong
                wsWithId.on('pong', () => {
                    wsWithId.isAlive = true;
                });
                // Handle messages
                wsWithId.on('message', this.handleMessage(wsWithId));
                // Handle close
                wsWithId.on('close', () => {
                    if (wsWithId.userId) {
                        this.clients.delete(wsWithId.userId.toString());
                        logger.info('Client disconnected', { userId: wsWithId.userId });
                    }
                });
                // Store client
                this.clients.set(wsWithId.userId.toString(), wsWithId);
                logger.info('Client connected', { userId: wsWithId.userId });
            }
            catch (error) {
                logger.error('WebSocket connection error', { error });
                ws.close(1008, 'Invalid token');
            }
        });
        this.wss.on('error', error => {
            logger.error('WebSocket server error', { error });
        });
    }
    startHeartbeat(interval = 30000) {
        return setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const client = ws;
                if (!client.isAlive) {
                    client.terminate();
                    return;
                }
                client.isAlive = false;
                client.ping();
            });
        }, interval);
    }
    handleMessage(client) {
        return (message) => {
            try {
                const data = JSON.parse(message.toString());
                switch (data.type) {
                    case 'ping':
                        client.send(JSON.stringify({ type: 'pong' }));
                        break;
                    default:
                        client.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
                }
            }
            catch (error) {
                client.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        };
    }
    broadcast(type, payload) {
        const message = JSON.stringify({ type, payload });
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    logger.error('Broadcast error', { error, userId: client.userId });
                }
            }
        });
    }
    emitToUser(userId, type, payload) {
        const client = this.clients.get(userId.toString());
        if (client && client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify({ type, payload }));
            }
            catch (error) {
                logger.error('Send to user error', { error, userId });
            }
        }
    }
    close() {
        clearInterval(this.pingInterval);
        this.clients.forEach(client => {
            try {
                client.terminate();
            }
            catch (error) {
                logger.error('Error closing client', { error });
            }
        });
        this.wss.close();
    }
    getConnectedClientsCount() {
        let web = 0;
        let mobile = 0;
        this.clients.forEach(client => {
            if (client.deviceId?.startsWith('web')) {
                web++;
            }
            else {
                mobile++;
            }
        });
        return {
            total: this.clients.size,
            web,
            mobile
        };
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
}
WebSocketService.instance = null;
let wsService = null;
export function initializeWebSocket(server) {
    wsService = WebSocketService.getInstance();
    server.on('upgrade', (request, socket, head) => {
        const { pathname } = new URL(request.url || '', `ws://${request.headers.host}`);
        if (pathname === '/ws' || pathname === '/') {
            wsService?.handleUpgrade(request, socket, head);
        }
        else {
            socket.destroy();
        }
    });
}
export function getWebSocketService() {
    if (!wsService) {
        throw new Error('WebSocket service not initialized');
    }
    return wsService;
}
//# sourceMappingURL=websocket.js.map
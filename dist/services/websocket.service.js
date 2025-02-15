import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
;
import { verifyToken } from '../utils/auth.js';
import logger from '../utils/logger.js';
import { IncomingMessage } from 'http';
import { WebSocketClient, WebSocketMessage, AuthMessage, SubscriptionMessage, isWebSocketMessage, isAuthMessage, isSubscriptionMessage, } from '../types/websocket.js';
export class WebSocketService {
    constructor(server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.clients = new Set();
        this.pingInterval = setInterval(() => this.checkConnections(), 15000);
        this.setupWebSocket();
    }
    static getInstance(server) {
        if (!WebSocketService.instance && server) {
            WebSocketService.instance = new WebSocketService(server);
        }
        return WebSocketService.instance;
    }
    setupWebSocket() {
        this.wss.on('connection', async (ws, request) => {
            try {
                const token = request.url?.split('token=')[1]?.split('&')[0];
                const deviceType = request.url?.split('deviceType=')[1]?.split('&')[0];
                const deviceId = request.url?.split('deviceId=')[1]?.split('&')[0];
                if (!token || !deviceType || !deviceId) {
                    ws.close(4000, 'Missing required parameters');
                    return;
                }
                const payload = await verifyToken(token);
                const client = ws;
                client.userId = new ObjectId(payload.id);
                client.subscriptions = new Set();
                client.deviceType = deviceType;
                client.deviceId = deviceId;
                client.lastPing = Date.now();
                this.clients.add(client);
                logger.info(`Client connected: ${client.userId} (${deviceType})`);
                this.setupClientHandlers(client);
            }
            catch (error) {
                logger.error('WebSocket connection error:', error);
                ws.close(4001, 'Authentication failed');
            }
        });
    }
    setupClientHandlers(client) {
        client.on('message', async (data) => {
            try {
                const event = JSON.parse(data.toString());
                await this.handleClientMessage(client, event);
            }
            catch (error) {
                logger.error('Error handling WebSocket message:', error);
                this.sendError(client, 'Invalid message format');
            }
        });
        client.on('close', () => {
            this.clients.delete(client);
            logger.info(`Client disconnected: ${client.userId} (${client.deviceType})`);
        });
        client.on('error', (err) => {
            logger.error(`WebSocket error for client ${client.userId}:`, err);
            this.clients.delete(client);
        });
        client.on('pong', () => {
            client.lastPing = Date.now();
        });
    }
    checkConnections() {
        const now = Date.now();
        this.clients.forEach(client => {
            if (now - client.lastPing > 30000) {
                // Client hasn't responded to ping for 30 seconds
                client.terminate();
                this.clients.delete(client);
                logger.warn(`Client terminated due to inactivity: ${client.userId} (${client.deviceType})`);
            }
            else {
                client.ping();
            }
        });
    }
    async handleClientMessage(client, event) {
        switch (event.type) {
            case 'subscribe':
                if (typeof event.payload === 'string') {
                    client.subscriptions.add(event.payload);
                    logger.debug(`Client ${client.userId} subscribed to ${event.payload}`);
                }
                break;
            case 'unsubscribe':
                if (typeof event.payload === 'string') {
                    client.subscriptions.delete(event.payload);
                    logger.debug(`Client ${client.userId} unsubscribed from ${event.payload}`);
                }
                break;
            case 'ping':
                client.lastPing = Date.now();
                this.send(client, { type: 'pong', payload: null });
                break;
            default:
                this.sendError(client, 'Unknown event type');
        }
    }
    /**
     * Send message to a specific client
     */
    send(client, event) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(event));
        }
    }
    /**
     * Send error message to a client
     */
    sendError(client, message) {
        this.send(client, {
            type: 'error',
            payload: { message },
        });
    }
    /**
     * Emit event to a specific user across all their devices
     */
    emitToUser(userId, type, payload) {
        const userClients = Array.from(this.clients).filter(client => client.userId.equals(userId));
        userClients.forEach(client => {
            this.send(client, { type, payload });
        });
    }
    /**
     * Emit event to all subscribers of a topic
     */
    emitToTopic(topic, type, payload) {
        const subscribers = Array.from(this.clients).filter(client => client.subscriptions.has(topic));
        subscribers.forEach(client => {
            this.send(client, { type, payload });
        });
    }
    /**
     * Emit event to all clients of a specific type
     */
    emitToDeviceType(deviceType, type, payload) {
        const targetClients = Array.from(this.clients).filter(client => client.deviceType === deviceType);
        targetClients.forEach(client => {
            this.send(client, { type, payload });
        });
    }
    /**
     * Broadcast event to all connected clients
     */
    broadcast(type, payload) {
        this.clients.forEach(client => {
            this.send(client, { type, payload });
        });
    }
    /**
     * Get number of connected clients
     */
    getConnectedClientsCount() {
        const counts = {
            total: this.clients.size,
            web: 0,
            mobile: 0,
        };
        this.clients.forEach(client => {
            counts[client.deviceType]++;
        });
        return counts;
    }
    /**
     * Clean up resources
     */
    cleanup() {
        clearInterval(this.pingInterval);
        this.clients.forEach(client => {
            client.terminate();
        });
        this.clients.clear();
        this.wss.close();
    }
}
//# sourceMappingURL=websocket.service.js.map
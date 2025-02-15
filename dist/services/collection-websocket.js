import { WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
;
import { IncomingMessage } from 'http';
import { connectToDatabase } from '../db.js';
import { WebSocketClient, WebSocketMessage, isWebSocketMessage } from '../types/websocket.js';
import logger from '../utils/logger.js';
let wss;
export function initializeCollectionWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws/collections' });
    wss.on('connection', async (ws, request) => {
        ws.isAlive = true;
        ws.subscriptions = new Set();
        try {
            // Extract token from query string
            const url = new URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                ws.close(1008, 'Token required');
                return;
            }
            // Verify token
            const decoded = verify(token, process.env.JWT_SECRET);
            ws.userId = new ObjectId(decoded.id);
            // Set up ping-pong for connection health check
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            // Handle subscription messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (!isWebSocketMessage(message)) {
                        throw new Error('Invalid message format');
                    }
                    switch (message.type) {
                        case 'subscribe': {
                            const collectionId = message.channel;
                            if (!collectionId)
                                break;
                            // Verify access
                            const db = await connectToDatabase();
                            const hasAccess = await db.collection('recipe_collections').findOne({
                                _id: new ObjectId(collectionId),
                                $or: [{ userId: ws.userId }, { 'collaborators.userId': ws.userId }],
                            });
                            if (hasAccess) {
                                ws.subscriptions.add(collectionId);
                                ws.send(JSON.stringify({
                                    type: 'message',
                                    timestamp: Date.now(),
                                    data: {
                                        type: 'subscribed',
                                        collectionId,
                                    },
                                }));
                            }
                            break;
                        }
                        case 'unsubscribe': {
                            const collectionId = message.channel;
                            if (collectionId) {
                                ws.subscriptions.delete(collectionId);
                                ws.send(JSON.stringify({
                                    type: 'message',
                                    timestamp: Date.now(),
                                    data: {
                                        type: 'unsubscribed',
                                        collectionId,
                                    },
                                }));
                            }
                            break;
                        }
                    }
                }
                catch (error) {
                    logger.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        timestamp: Date.now(),
                        error: {
                            code: 'INVALID_MESSAGE',
                            message: 'Invalid message format',
                        },
                    }));
                }
            });
            // Handle client disconnect
            ws.on('close', () => {
                ws.subscriptions.clear();
            });
        }
        catch (error) {
            logger.error('WebSocket connection error:', error);
            ws.close(1008, 'Authentication failed');
        }
    });
    // Set up periodic health checks
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client;
            if (!ws.isAlive) {
                ws.subscriptions.clear();
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on('close', () => {
        clearInterval(interval);
    });
}
export function notifyCollectionUpdate(notification) {
    if (!wss)
        return;
    const message = {
        type: 'message',
        timestamp: Date.now(),
        data: notification,
    };
    wss.clients.forEach(client => {
        const ws = client;
        if (ws.readyState === ws.OPEN && ws.subscriptions.has(notification.collectionId)) {
            ws.send(JSON.stringify(message));
        }
    });
}
export function getCollectionWebSocketService() {
    return {
        notifyCollectionUpdate,
    };
}
//# sourceMappingURL=collection-websocket.js.map
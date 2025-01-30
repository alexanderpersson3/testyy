import { WebSocket, WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { IncomingMessage } from 'http';
import { connectToDatabase } from '../db/db.js';

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId: string;
  subscriptions: Set<string>; // Collection IDs
}

type CollectionEventType = 
  | 'collection_updated' 
  | 'recipe_added' 
  | 'recipe_removed' 
  | 'collaborator_added' 
  | 'collaborator_removed' 
  | 'collaborator_updated'
  | 'collection_created'
  | 'collection_shared'
  | 'collection_unshared';

interface CollectionNotification {
  type: CollectionEventType;
  collectionId: string;
  data: any;
}

let wss: WebSocketServer;

export function initializeCollectionWebSocket(server: any) {
  wss = new WebSocketServer({ server, path: '/ws/collections' });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    const client = ws as WebSocketClient;
    client.isAlive = true;
    client.subscriptions = new Set();

    try {
      // Extract token from query string
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        client.close(1008, 'Token required');
        return;
      }

      // Verify token
      const decoded = verify(token, process.env.JWT_SECRET!) as { id: string };
      client.userId = decoded.id;

      // Set up ping-pong for connection health check
      client.on('pong', () => {
        client.isAlive = true;
      });

      // Handle subscription messages
      client.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          switch (message.action) {
            case 'subscribe': {
              const collectionId = message.collectionId;
              if (!collectionId) break;

              // Verify access
              const db = await connectToDatabase();
              const hasAccess = await db.collection('recipe_collections').findOne({
                _id: new ObjectId(collectionId),
                $or: [
                  { userId: new ObjectId(client.userId) },
                  { 'collaborators.userId': new ObjectId(client.userId) }
                ]
              });

              if (hasAccess) {
                client.subscriptions.add(collectionId);
                client.send(JSON.stringify({
                  type: 'subscribed',
                  collectionId
                }));
              }
              break;
            }
            case 'unsubscribe': {
              const collectionId = message.collectionId;
              if (collectionId) {
                client.subscriptions.delete(collectionId);
                client.send(JSON.stringify({
                  type: 'unsubscribed',
                  collectionId
                }));
              }
              break;
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      // Handle client disconnect
      client.on('close', () => {
        client.subscriptions.clear();
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.close(1008, 'Authentication failed');
    }
  });

  // Set up periodic health checks
  const interval = setInterval(() => {
    Array.from(wss.clients).forEach((ws: WebSocket) => {
      const client = ws as WebSocketClient;
      if (!client.isAlive) {
        client.subscriptions.clear();
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

export function notifyCollectionUpdate(notification: CollectionNotification) {
  if (!wss) return;

  const message = JSON.stringify(notification);

  Array.from(wss.clients).forEach((ws: WebSocket) => {
    const client = ws as WebSocketClient;
    if (client.readyState === WebSocket.OPEN && client.subscriptions.has(notification.collectionId)) {
      client.send(message);
    }
  });
}

export function getCollectionWebSocketService() {
  return {
    notifyCollectionUpdate
  };
} 
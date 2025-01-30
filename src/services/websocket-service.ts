import { WebSocket, WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/auth.js';
import { WebSocketClient, WebSocketMessage } from '../types/websocket';

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient>;
  private pingInterval: NodeJS.Timeout;

  constructor(server: HttpServer) {
    console.log('Creating WebSocket server');
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    this.setupWebSocket();
    this.pingInterval = setInterval(() => this.ping(), 30000);
    this.pingInterval.unref(); // Allow the process to exit even if the interval is still running
    console.log('WebSocket server created');
  }

  private setupWebSocket() {
    console.log('Setting up WebSocket server');

    this.wss.on('connection', async (ws: WebSocketClient, req) => {
      console.log('New WebSocket connection attempt from:', req.headers.origin);
      console.log('Request URL:', req.url);
      console.log('Request headers:', req.headers);

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

        this.clients.set(ws.sessionId!, ws);
        console.log(`Client authenticated: ${ws.userId}`);

        ws.on('pong', () => {
          ws.isAlive = true;
          console.log(`Received pong from client ${ws.userId}`);
        });

        ws.on('message', (message: Buffer) => {
          console.log(`Received message from ${ws.userId}:`, message.toString());
          this.handleMessage(ws, message);
        });

        ws.on('close', (code, reason) => {
          console.log(`Client disconnected: ${ws.userId}, code: ${code}, reason: ${reason}`);
          this.clients.delete(ws.sessionId!);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for client ${ws.userId}:`, error);
          this.clients.delete(ws.sessionId!);
          ws.terminate();
        });

      } catch (error) {
        console.log('Rejecting connection: Invalid token');
        console.error('Token validation error:', error);
        ws.close(1008, 'Invalid token');
      }
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.wss.on('listening', () => {
      console.log('WebSocket server is listening');
    });
  }

  private ping() {
    this.clients.forEach((client) => {
      if (!client.isAlive) {
        console.log(`Terminating inactive client: ${client.userId}`);
        client.terminate();
        return;
      }

      client.isAlive = false;
      try {
        client.ping();
        console.log(`Sent ping to client ${client.userId}`);
      } catch (error) {
        console.error(`Error pinging client ${client.userId}:`, error);
        client.terminate();
      }
    });
  }

  private handleMessage(client: WebSocketClient, message: Buffer) {
    try {
      const data: WebSocketMessage = JSON.parse(message.toString());
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
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      client.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  }

  public broadcast(message: string | Buffer, excludeClient?: string) {
    this.clients.forEach((client, sessionId) => {
      if (sessionId !== excludeClient && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error(`Error broadcasting to client ${client.userId}:`, error);
        }
      }
    });
  }

  public sendToUser(userId: string, message: string | Buffer) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error(`Error sending message to client ${client.userId}:`, error);
        }
      }
    });
  }

  public close() {
    console.log('Closing WebSocket server');
    clearInterval(this.pingInterval);
    return new Promise<void>((resolve) => {
      // Close all client connections
      this.clients.forEach((client) => {
        try {
          client.terminate();
        } catch (error) {
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
import { WebSocket, WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { ObjectId } from 'mongodb';

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId: string;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<WebSocketClient> = new Set();
  private pingInterval: NodeJS.Timeout;

  constructor(server: any, path: string) {
    this.wss = new WebSocketServer({ server, path });
    this.setupWebSocketServer();
    this.pingInterval = setInterval(() => this.ping(), 30000);
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      const client = ws as WebSocketClient;
      client.isAlive = true;
      client.subscriptions = new Set();

      try {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
          client.close(1008, 'Authentication required');
          return;
        }

        const decoded = verify(token, process.env.JWT_SECRET!) as { id: string };
        client.userId = decoded.id;
        this.clients.add(client);

        client.on('pong', () => {
          client.isAlive = true;
        });

        client.on('message', (message: Buffer) => {
          this.handleMessage(client, message);
        });

        client.on('close', () => {
          this.clients.delete(client);
        });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        client.close(1008, 'Invalid token');
      }
    });
  }

  private ping() {
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

  protected handleMessage(client: WebSocketClient, message: Buffer) {
    try {
      const data = JSON.parse(message.toString());
      client.send(JSON.stringify({ type: 'pong' }));
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  protected broadcast(message: string, filter?: (client: WebSocketClient) => boolean) {
    this.clients.forEach(client => {
      if (!filter || filter(client)) {
        client.send(message);
      }
    });
  }

  public close() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }

  public notifyListUpdate(listId: ObjectId, updateType: string, data: any) {
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

  public notifyItemUpdate(listId: ObjectId, updateType: string, data: any) {
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

let wsService: WebSocketService;

export function initializeWebSocket(server: any, path: string) {
  wsService = new WebSocketService(server, path);
}

export function getWebSocketService() {
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
} 
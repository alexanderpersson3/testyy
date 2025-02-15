import { ObjectId } from 'mongodb';
import { WebSocket, WebSocketServer } from 'ws';
import { BaseService } from './base.service.js';
import logger from '../utils/logger.js';

/**
 * WebSocket message types
 */
export type WebSocketEventType =
  | 'authenticate'
  | 'subscribe'
  | 'unsubscribe'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'comment_voted'
  | 'comment_reported'
  | 'collection_created'
  | 'collection_updated'
  | 'collection_deleted'
  | 'collection_recipe_added'
  | 'collection_recipe_removed'
  | 'collection_collaborator_added'
  | 'collection_collaborator_removed'
  | 'collection_recipe_reordered'
  | 'error';

export type WebSocketMessage = {
  type: WebSocketEventType;
  data: unknown;
};

/**
 * WebSocket client with metadata
 */
interface WebSocketClient extends WebSocket {
  userId?: ObjectId;
  subscribedRecipes?: Set<string>;
  isModerator?: boolean;
}

/**
 * Service for managing WebSocket connections and real-time updates
 */
export class WebSocketService extends BaseService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocketClient> = new Set();

  private constructor() {
    super();
  }

  /**
   * Gets the singleton instance of WebSocketService
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  protected override async doInitialize(): Promise<void> {
    if (this.wss) return;

    this.wss = new WebSocketServer({
      port: Number(process.env.WS_PORT) || 8080,
      clientTracking: true
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocketClient): void {
    this.clients.add(ws);

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error);
      ws.terminate();
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(client: WebSocketClient, message: WebSocketMessage): void {
    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(client, message.data as { userId: string; isModerator?: boolean });
        break;
      case 'subscribe':
        this.handleSubscription(client, message.data as { recipeId: string });
        break;
      case 'unsubscribe':
        this.handleUnsubscription(client, message.data as { recipeId: string });
        break;
      default:
        logger.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Handle client authentication
   */
  private handleAuthentication(
    client: WebSocketClient,
    data: { userId: string; isModerator?: boolean }
  ): void {
    client.userId = new ObjectId(data.userId);
    client.isModerator = data.isModerator;
    client.subscribedRecipes = new Set();
  }

  /**
   * Handle recipe subscription
   */
  private handleSubscription(client: WebSocketClient, data: { recipeId: string }): void {
    if (!client.subscribedRecipes) {
      client.subscribedRecipes = new Set();
    }
    client.subscribedRecipes.add(data.recipeId);
  }

  /**
   * Handle recipe unsubscription
   */
  private handleUnsubscription(client: WebSocketClient, data: { recipeId: string }): void {
    client.subscribedRecipes?.delete(data.recipeId);
  }

  /**
   * Handle WebSocket server error
   */
  private handleError(error: Error): void {
    logger.error('WebSocket server error:', error);
  }

  /**
   * Send message to specific client
   */
  private sendMessage(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Notify recipe subscribers about an event
   */
  public notifyRecipeSubscribers(recipeId: ObjectId, message: WebSocketMessage): void {
    const recipeIdStr = recipeId.toString();
    this.clients.forEach(client => {
      if (client.subscribedRecipes?.has(recipeIdStr)) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Notify moderators about an event
   */
  public notifyModerators(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.isModerator) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      this.sendMessage(client, message);
    });
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: ObjectId, message: WebSocketMessage): void {
    const userIdStr = userId.toString();
    this.clients.forEach(client => {
      if (client.userId?.toString() === userIdStr) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.clients.forEach(client => {
      client.terminate();
    });
    this.clients.clear();
    this.wss?.close();
  }
}

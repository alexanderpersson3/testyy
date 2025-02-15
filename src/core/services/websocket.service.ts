/**
 * WebSocket service for real-time communication
 */
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ObjectId } from 'mongodb';
import logger from '../utils/logger';

export class WebSocketService {
  private static instance: WebSocketService;
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map();

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(server: HttpServer): void {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('authenticate', (userId: string) => {
        this.addUserSocket(userId, socket.id);
        socket.join(`user:${userId}`);
        logger.info(`User ${userId} authenticated on socket ${socket.id}`);
      });

      socket.on('disconnect', () => {
        this.removeSocket(socket.id);
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  private removeSocket(socketId: string): void {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  public notifyUsers(userIds: ObjectId[], event: string, data: any): void {
    userIds.forEach(userId => {
      this.io.to(`user:${userId.toString()}`).emit(event, data);
      logger.debug(`Notified user ${userId} of event ${event}`, { data });
    });
  }

  public notifyAll(event: string, data: any): void {
    this.io.emit(event, data);
    logger.debug(`Broadcast event ${event}`, { data });
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  public getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
} 
import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { WebSocketService } from '../websocket-service.js';;
import { NotificationService } from '../notification.service.js';;
import { ShoppingListService } from '../shopping-list.service.js';;
import type { RecipeService } from '../types/express.js';
import { NotificationType, NotificationChannel } from '../types.js';;
import { ShoppingList } from '../types/shopping-list.js';;
import logger from '../utils/logger.js';

type UpdateType = 
  | 'shopping_list_update'
  | 'recipe_update'
  | 'comment_update'
  | 'rating_update'
  | 'price_update'
  | 'inventory_update'
  | 'cooking_session_update';

interface Collaborator {
  userId: string | ObjectId;
  notified?: boolean;
}

interface Participant {
  userId: string | ObjectId;
  notified?: boolean;
}

interface UpdatePayload {
  type: UpdateType;
  resourceId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  userId: string;
  timestamp: number;
}

export class RealTimeUpdateService {
  private static instance: RealTimeUpdateService;
  private wsService: WebSocketService;
  private notificationService: NotificationService;
  private shoppingListService: ShoppingListService;
  private recipeService: RecipeService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.shoppingListService = ShoppingListService.getInstance();
    this.recipeService = RecipeService.getInstance();
  }

  static getInstance(): RealTimeUpdateService {
    if (!RealTimeUpdateService.instance) {
      RealTimeUpdateService.instance = new RealTimeUpdateService();
    }
    return RealTimeUpdateService.instance;
  }

  /**
   * Handle shopping list updates
   */
  async handleShoppingListUpdate(
    listId: ObjectId,
    action: UpdatePayload['action'],
    data: any,
    userId: ObjectId
  ): Promise<void> {
    try {
      const listIdStr = listId.toString();
      const update: UpdatePayload = {
        type: 'shopping_list_update',
        resourceId: listIdStr,
        action,
        data,
        userId: userId.toString(),
        timestamp: Date.now(),
      };

      // Send real-time update to web clients
      this.wsService.notifyListUpdate(listIdStr, action, update);

      // Send push notification to mobile clients if needed
      if (action === 'update' && data.collaborators) {
        const newCollaborators = data.collaborators.filter(
          (c: Collaborator) => !c.notified && c.userId.toString() !== userId.toString()
        );

        if (newCollaborators.length > 0) {
          const list = await this.shoppingListService.getList(listId, userId);
          if (!list) {
            logger.error(`Shopping list not found: ${listIdStr}`);
            return;
          }

          await Promise.all(
            newCollaborators.map(async (collaborator: Collaborator) => {
              const collaboratorId = typeof collaborator.userId === 'string'
                ? new ObjectId(collaborator.userId)
                : collaborator.userId;
              await this.notificationService.create(
                collaboratorId,
                'new_story' as NotificationType,
                'New Shopping List Shared',
                `${list.createdBy.name} shared a shopping list with you: ${list.name}`,
                { listId: listIdStr },
                [NotificationChannel.PUSH, NotificationChannel.IN_APP]
              );
            })
          );
        }
      }
    } catch (error) {
      logger.error('Failed to handle shopping list update:', error);
      throw error;
    }
  }

  /**
   * Handle recipe updates
   */
  async handleRecipeUpdate(
    recipeId: ObjectId,
    action: UpdatePayload['action'],
    data: any,
    userId: ObjectId
  ): Promise<void> {
    try {
      const recipeIdStr = recipeId.toString();
      const update: UpdatePayload = {
        type: 'recipe_update',
        resourceId: recipeIdStr,
        action,
        data,
        userId: userId.toString(),
        timestamp: Date.now(),
      };

      // Send real-time update to web clients
      this.wsService.notifyListUpdate(recipeIdStr, action, update);

      // Handle different types of recipe updates
      if (action === 'update') {
        const recipe = await this.recipeService.getRecipe(recipeId);
        if (!recipe || !recipe.userId) {
          logger.error(`Recipe not found or invalid: ${recipeIdStr}`);
          return;
        }
        
        if (data.rating) {
          // New rating added
          await this.notificationService.create(
            recipe.userId,
            'recipe_like' as NotificationType,
            'New Recipe Rating',
            `Someone rated your recipe "${recipe.title}"`,
            { recipeId: recipeIdStr, rating: data.rating },
            [NotificationChannel.PUSH, NotificationChannel.IN_APP]
          );
        } else if (data.comment) {
          // New comment added
          await this.notificationService.create(
            recipe.userId,
            'recipe_comment' as NotificationType,
            'New Recipe Comment',
            `Someone commented on your recipe "${recipe.title}"`,
            { recipeId: recipeIdStr, comment: data.comment },
            [NotificationChannel.PUSH, NotificationChannel.IN_APP]
          );
        }
      }
    } catch (error) {
      logger.error('Failed to handle recipe update:', error);
      throw error;
    }
  }

  /**
   * Handle price updates
   */
  async handlePriceUpdate(
    itemId: ObjectId,
    data: any,
    affectedLists: ObjectId[]
  ): Promise<void> {
    try {
      const itemIdStr = itemId.toString();
      const update: UpdatePayload = {
        type: 'price_update',
        resourceId: itemIdStr,
        action: 'update',
        data,
        userId: 'system',
        timestamp: Date.now(),
      };

      // Notify web clients about price changes
      this.wsService.notifyListUpdate(itemIdStr, 'price_update', update);

      // Notify affected shopping lists
      affectedLists.forEach(listId => {
        const listIdStr = listId.toString();
        this.wsService.notifyListUpdate(listIdStr, 'price_update', {
          itemId: itemIdStr,
          ...data,
        });
      });

      // Send price alert notifications if threshold is met
      if (data.priceChange && Math.abs(data.priceChange) >= 0.2) { // 20% change
        const lists = await Promise.all(
          affectedLists.map(id => this.shoppingListService.getList(id, new ObjectId(data.userId)))
        );

        const validLists = lists.filter((list: ShoppingList | null): list is ShoppingList => list !== null);
        const uniqueUsers = new Set(
          validLists.flatMap(list => [
            typeof list.userId === 'string' ? list.userId : list.userId.toString(),
            ...list.collaborators.map(c => 
              typeof c.userId === 'string' ? c.userId : c.userId.toString()
            ),
          ])
        );

        await Promise.all(
          Array.from(uniqueUsers).map(async userIdStr => {
            const userObjectId = typeof userIdStr === 'string'
              ? new ObjectId(userIdStr)
              : userIdStr;
            await this.notificationService.create(
              userObjectId,
              'performance_alert' as NotificationType,
              'Price Alert',
              `Price ${data.priceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(
                data.priceChange * 100
              )}% for ${data.itemName}`,
              { itemId: itemIdStr, ...data },
              [NotificationChannel.PUSH, NotificationChannel.IN_APP]
            );
          })
        );
      }
    } catch (error) {
      logger.error('Failed to handle price update:', error);
      throw error;
    }
  }

  /**
   * Handle cooking session updates
   */
  async handleCookingSessionUpdate(
    sessionId: ObjectId,
    action: UpdatePayload['action'],
    data: any,
    userId: ObjectId
  ): Promise<void> {
    try {
      const sessionIdStr = sessionId.toString();
      const update: UpdatePayload = {
        type: 'cooking_session_update',
        resourceId: sessionIdStr,
        action,
        data,
        userId: userId.toString(),
        timestamp: Date.now(),
      };

      // Send real-time update to web clients
      this.wsService.notifyListUpdate(sessionIdStr, action, update);

      // Handle different types of session updates
      if (action === 'update' && data.participants) {
        const newParticipants = data.participants.filter(
          (p: Participant) => !p.notified && p.userId.toString() !== userId.toString()
        );

        if (newParticipants.length > 0) {
          await Promise.all(
            newParticipants.map(async (participant: Participant) => {
              const participantId = typeof participant.userId === 'string'
                ? new ObjectId(participant.userId)
                : participant.userId;
              await this.notificationService.create(
                participantId,
                'cooking_session_invite' as NotificationType,
                'Cooking Session Invitation',
                `You've been invited to join a cooking session`,
                { sessionId: sessionIdStr },
                [NotificationChannel.PUSH, NotificationChannel.IN_APP]
              );
            })
          );
        }
      }
    } catch (error) {
      logger.error('Failed to handle cooking session update:', error);
      throw error;
    }
  }

  /**
   * Subscribe a user to updates for specific topics
   */
  subscribeToUpdates(userId: ObjectId, topics: string[]): void {
    topics.forEach(topic => {
      this.wsService.broadcast('subscribe', { topic, userId: userId.toString() });
    });
  }

  /**
   * Unsubscribe a user from specific topics
   */
  unsubscribeFromUpdates(userId: ObjectId, topics: string[]): void {
    topics.forEach(topic => {
      this.wsService.broadcast('unsubscribe', { topic, userId: userId.toString() });
    });
  }
}

import { ObjectId } from 'mongodb';
import { ShoppingRepository } from '../repositories/shopping.repository';
import type {
  ShoppingList,
  Store,
  StoreDeal,
  StoreProduct,
  CreateShoppingListDTO,
  UpdateShoppingListDTO,
  CreateStoreDTO,
  UpdateStoreDTO,
  ShoppingListSearchParams,
  StoreSearchParams,
  ShoppingListStats
} from '../types/shopping.types';
import { ValidationError } from '../../../core/errors/validation.error';
import { elasticClient } from '../../../services/elastic-client';
import { WebSocketService } from '../../../core/services/websocket.service';
import logger from '../../../core/utils/logger';

export class ShoppingService {
  private static instance: ShoppingService;
  private shoppingRepository: ShoppingRepository;
  private wsService: WebSocketService;

  private constructor() {
    this.shoppingRepository = ShoppingRepository.getInstance();
    this.wsService = WebSocketService.getInstance();
  }

  public static getInstance(): ShoppingService {
    if (!ShoppingService.instance) {
      ShoppingService.instance = new ShoppingService();
    }
    return ShoppingService.instance;
  }

  // Shopping List Operations
  async createShoppingList(userId: ObjectId, input: CreateShoppingListDTO): Promise<ShoppingList> {
    // Validate input
    if (!input.name) {
      throw new ValidationError('Shopping list name is required');
    }

    const list = await this.shoppingRepository.createShoppingList({
      ...input,
      userId,
      status: 'active',
      items: input.items || [],
      lastModified: new Date(),
    });

    // Notify connected clients
    this.wsService.notifyUsers([userId], 'shopping-list-created', {
      listId: list._id,
      name: list.name,
    });

    return list;
  }

  async getShoppingList(listId: ObjectId, userId: ObjectId): Promise<ShoppingList> {
    const list = await this.shoppingRepository.getShoppingList(listId);

    // Check access permissions
    if (list.userId.toString() !== userId.toString() && 
        !list.sharedWith?.some(id => id.toString() === userId.toString())) {
      throw new ValidationError('Access denied');
    }

    return list;
  }

  async updateShoppingList(
    listId: ObjectId,
    userId: ObjectId,
    update: UpdateShoppingListDTO
  ): Promise<ShoppingList> {
    // Verify ownership
    const existingList = await this.getShoppingList(listId, userId);
    if (existingList.userId.toString() !== userId.toString()) {
      throw new ValidationError('Only the owner can update the list');
    }

    const updatedList = await this.shoppingRepository.updateShoppingList(listId, update);

    // Notify connected clients
    if (existingList.sharedWith?.length) {
      this.wsService.notifyUsers([...existingList.sharedWith], 'shopping-list-updated', {
        listId: updatedList._id,
        name: updatedList.name,
      });
    }

    return updatedList;
  }

  async deleteShoppingList(listId: ObjectId, userId: ObjectId): Promise<boolean> {
    // Verify ownership
    const list = await this.getShoppingList(listId, userId);
    if (list.userId.toString() !== userId.toString()) {
      throw new ValidationError('Only the owner can delete the list');
    }

    const deleted = await this.shoppingRepository.deleteShoppingList(listId);

    if (deleted && list.sharedWith?.length) {
      this.wsService.notifyUsers([...list.sharedWith], 'shopping-list-deleted', {
        listId: list._id,
      });
    }

    return deleted;
  }

  async searchShoppingLists(params: ShoppingListSearchParams): Promise<ShoppingList[]> {
    return this.shoppingRepository.searchShoppingLists(params);
  }

  async shareShoppingList(
    listId: ObjectId,
    ownerId: ObjectId,
    shareWithUserId: ObjectId
  ): Promise<ShoppingList> {
    const list = await this.getShoppingList(listId, ownerId);
    
    if (list.userId.toString() !== ownerId.toString()) {
      throw new ValidationError('Only the owner can share the list');
    }

    const sharedWith = new Set([...(list.sharedWith || []).map(id => id.toString())]);
    sharedWith.add(shareWithUserId.toString());

    const updatedList = await this.shoppingRepository.updateShoppingList(listId, {
      sharedWith: Array.from(sharedWith).map(id => new ObjectId(id)),
    });

    // Notify the user who received access
    this.wsService.notifyUsers([shareWithUserId], 'shopping-list-shared', {
      listId: updatedList._id,
      name: updatedList.name,
      sharedBy: ownerId,
    });

    return updatedList;
  }

  // Store Operations
  async createStore(input: CreateStoreDTO): Promise<Store> {
    const store = await this.shoppingRepository.createStore({
      ...input,
      ratings: { average: 0, count: 0 },
      isActive: true,
    });

    // Index in Elasticsearch for better search
    await elasticClient.index({
      index: 'stores',
      id: store._id.toString(),
      body: {
        name: store.name,
        city: store.location.city,
        features: store.features,
        location: {
          lat: store.location.coordinates?.latitude,
          lon: store.location.coordinates?.longitude,
        },
      },
    });

    return store;
  }

  async updateStore(storeId: ObjectId, update: UpdateStoreDTO): Promise<Store> {
    const store = await this.shoppingRepository.updateStore(storeId, update);

    // Update Elasticsearch index
    if (update.name || update.location || update.features) {
      await elasticClient.update({
        index: 'stores',
        id: storeId.toString(),
        body: {
          doc: {
            name: update.name,
            city: update.location?.city,
            features: update.features,
            location: update.location?.coordinates ? {
              lat: update.location.coordinates.latitude,
              lon: update.location.coordinates.longitude,
            } : undefined,
          },
        },
      });
    }

    return store;
  }

  async searchStores(params: StoreSearchParams): Promise<Store[]> {
    return this.shoppingRepository.searchStores(params);
  }

  async getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]> {
    return this.shoppingRepository.getStoreDeals(storeId);
  }

  async getStoreProducts(storeId: ObjectId, category?: string): Promise<StoreProduct[]> {
    return this.shoppingRepository.getStoreProducts(storeId, category);
  }

  // Statistics
  async getShoppingListStats(userId: ObjectId): Promise<ShoppingListStats> {
    return this.shoppingRepository.getShoppingListStats(userId);
  }
} 
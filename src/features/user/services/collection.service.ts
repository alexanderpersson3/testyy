import { ObjectId } from 'mongodb';
import { BaseService } from './base.service.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import type { CollectionDocument, CollectionSearchParams } from '../repositories/collection.repository.js';
import { NotFoundError, AuthorizationError } from '../types/errors.js';
import { WebSocketService } from './websocket.service.js';

export interface CreateCollectionDTO {
  name: string;
  description?: string;
  privacy?: 'private' | 'public' | 'shared';
  tags?: string[];
  settings?: {
    allowComments?: boolean;
    showIngredients?: boolean;
    showNutrition?: boolean;
    defaultSort?: 'manual' | 'date' | 'title' | 'popularity';
  };
}

export interface UpdateCollectionDTO {
  name?: string;
  description?: string;
  privacy?: 'private' | 'public' | 'shared';
  tags?: string[];
  settings?: {
    allowComments?: boolean;
    showIngredients?: boolean;
    showNutrition?: boolean;
    defaultSort?: 'manual' | 'date' | 'title' | 'popularity';
  };
}

export class CollectionService extends BaseService {
  private static instance: CollectionService;
  private collectionRepository: CollectionRepository;
  private wsService: WebSocketService;

  private constructor() {
    super();
    this.collectionRepository = new CollectionRepository();
    this.wsService = WebSocketService.getInstance();
  }

  public static getInstance(): CollectionService {
    if (!CollectionService.instance) {
      CollectionService.instance = new CollectionService();
    }
    return CollectionService.instance;
  }

  protected override async doInitialize(): Promise<void> {
    // No additional initialization needed
  }

  async createCollection(
    userId: ObjectId,
    userName: string,
    data: CreateCollectionDTO
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.collectionRepository.create({
      name: data.name,
      description: data.description,
      owner: {
        _id: userId,
        name: userName
      },
      recipes: [],
      collaborators: [],
      privacy: data.privacy || 'private',
      tags: data.tags || [],
      stats: {
        recipeCount: 0,
        totalCookTime: 0,
        averageDifficulty: 0,
        cuisineDistribution: {},
        lastUpdated: new Date()
      },
      settings: {
        allowComments: data.settings?.allowComments ?? true,
        showIngredients: data.settings?.showIngredients ?? true,
        showNutrition: data.settings?.showNutrition ?? true,
        defaultSort: data.settings?.defaultSort || 'manual'
      },
      lastActivityAt: new Date()
    });

    this.wsService.broadcast({
      type: 'collection_created',
      data: { collection }
    });

    return collection;
  }

  async getCollection(collectionId: ObjectId, userId: ObjectId): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    // Check access permissions
    if (collection.privacy !== 'public' && 
        collection.owner._id.toString() !== userId.toString() &&
        !collection.collaborators.some(c => c.userId.toString() === userId.toString())) {
      throw new AuthorizationError('Not authorized to view this collection');
    }

    return collection;
  }

  async updateCollection(
    collectionId: ObjectId,
    userId: ObjectId,
    data: UpdateCollectionDTO
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to update this collection');
    }

    const updatedSettings = data.settings ? {
      allowComments: data.settings.allowComments ?? collection.settings.allowComments,
      showIngredients: data.settings.showIngredients ?? collection.settings.showIngredients,
      showNutrition: data.settings.showNutrition ?? collection.settings.showNutrition,
      defaultSort: data.settings.defaultSort ?? collection.settings.defaultSort
    } : undefined;

    const updated = await this.collectionRepository.updateById(collectionId, {
      ...data,
      settings: updatedSettings,
      lastActivityAt: new Date()
    });

    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_updated',
      data: { collectionId, updates: updated }
    });

    return updated;
  }

  async deleteCollection(collectionId: ObjectId, userId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to delete this collection');
    }

    const deleted = await this.collectionRepository.deleteById(collectionId);
    if (!deleted) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_deleted',
      data: { collectionId }
    });
  }

  async addRecipe(
    collectionId: ObjectId,
    userId: ObjectId,
    recipeId: ObjectId,
    recipeTitle: string
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString() &&
        !collection.collaborators.some(c => c.userId.toString() === userId.toString() && c.role === 'editor')) {
      throw new AuthorizationError('Not authorized to add recipes to this collection');
    }

    const updated = await this.collectionRepository.addRecipe(collectionId, recipeId, recipeTitle);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_recipe_added',
      data: { collectionId, recipeId }
    });

    return updated;
  }

  async removeRecipe(
    collectionId: ObjectId,
    userId: ObjectId,
    recipeId: ObjectId
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString() &&
        !collection.collaborators.some(c => c.userId.toString() === userId.toString() && c.role === 'editor')) {
      throw new AuthorizationError('Not authorized to remove recipes from this collection');
    }

    const updated = await this.collectionRepository.removeRecipe(collectionId, recipeId);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_recipe_removed',
      data: { collectionId, recipeId }
    });

    return updated;
  }

  async addCollaborator(
    collectionId: ObjectId,
    userId: ObjectId,
    collaboratorId: ObjectId,
    role: 'editor' | 'viewer'
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to manage collaborators');
    }

    const updated = await this.collectionRepository.addCollaborator(collectionId, collaboratorId, role);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_collaborator_added',
      data: { collectionId, collaboratorId, role }
    });

    return updated;
  }

  async removeCollaborator(
    collectionId: ObjectId,
    userId: ObjectId,
    collaboratorId: ObjectId
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to manage collaborators');
    }

    const updated = await this.collectionRepository.removeCollaborator(collectionId, collaboratorId);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_collaborator_removed',
      data: { collectionId, collaboratorId }
    });

    return updated;
  }

  async searchCollections(
    userId: ObjectId,
    params: CollectionSearchParams
  ): Promise<CollectionDocument[]> {
    await this.ensureInitialized();
    return this.collectionRepository.search({
      ...params,
      filters: {
        ...params.filters,
        $or: [
          { privacy: 'public' },
          { 'owner._id': userId },
          { 'collaborators.userId': userId }
        ]
      }
    });
  }

  async getUserCollections(userId: ObjectId): Promise<CollectionDocument[]> {
    await this.ensureInitialized();
    return this.collectionRepository.findByOwner(userId);
  }

  async getCollaboratingCollections(userId: ObjectId): Promise<CollectionDocument[]> {
    await this.ensureInitialized();
    return this.collectionRepository.findByCollaborator(userId);
  }

  async updateRecipeOrder(
    collectionId: ObjectId,
    userId: ObjectId,
    recipeId: ObjectId,
    newOrder: number
  ): Promise<CollectionDocument> {
    await this.ensureInitialized();

    const collection = await this.getCollection(collectionId, userId);
    if (collection.owner._id.toString() !== userId.toString() &&
        !collection.collaborators.some(c => c.userId.toString() === userId.toString() && c.role === 'editor')) {
      throw new AuthorizationError('Not authorized to reorder recipes in this collection');
    }

    const updated = await this.collectionRepository.updateRecipeOrder(collectionId, recipeId, newOrder);
    if (!updated) {
      throw new NotFoundError('Collection not found');
    }

    this.wsService.broadcast({
      type: 'collection_recipe_reordered',
      data: { collectionId, recipeId, newOrder }
    });

    return updated;
  }
}

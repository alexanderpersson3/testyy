;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { DatabaseService } from '../db/database.service.js';;
import logger from '../utils/logger.js';

export type TipCategory = 'cooking' | 'organization' | 'shopping' | 'general';
export type TipStatus = 'draft' | 'published' | 'archived';

export interface Tip {
  _id: ObjectId;
  title: string;
  content: string;
  category: TipCategory;
  tags: string[];
  status: TipStatus;
  author: {
    _id: ObjectId;
    name: string;
  };
  likes: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTipDTO {
  title: string;
  content: string;
  category: TipCategory;
  tags: string[];
  author: {
    _id: ObjectId;
    name: string;
  };
}

export interface UpdateTipDTO {
  title?: string;
  content?: string;
  category?: TipCategory;
  tags?: string[];
  status?: TipStatus;
}

export class TipsService {
  private static instance: TipsService;
  private initialized: boolean = false;
  private db: DatabaseService;
  private tipsCollection!: Collection<Tip>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize TipsService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.tipsCollection = this.db.getCollection<Tip>('tips');
      this.initialized = true;
      logger.info('TipsService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TipsService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): TipsService {
    if (!TipsService.instance) {
      TipsService.instance = new TipsService();
    }
    return TipsService.instance;
  }

  async createTip(data: CreateTipDTO): Promise<Tip> {
    await this.ensureInitialized();

    const now = new Date();
    const tip: Tip = {
      _id: new ObjectId(),
      ...data,
      status: 'draft',
      likes: 0,
      views: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.tipsCollection.insertOne(tip);
    return tip;
  }

  async getTip(tipId: ObjectId): Promise<Tip> {
    await this.ensureInitialized();

    const tip = await this.tipsCollection.findOne({ _id: tipId });
    if (!tip) {
      throw new NotFoundError('Tip not found');
    }

    return tip;
  }

  async updateTip(tipId: ObjectId, updates: UpdateTipDTO): Promise<Tip> {
    await this.ensureInitialized();

    const result = await this.tipsCollection.findOneAndUpdate(
      { _id: tipId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new NotFoundError('Tip not found');
    }

    return result.value;
  }

  async deleteTip(tipId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    const result = await this.tipsCollection.deleteOne({ _id: tipId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Tip not found');
    }
  }

  async getTips(options: {
    status?: TipStatus;
    category?: TipCategory;
    tags?: string[];
    page?: number;
    limit?: number;
  } = {}): Promise<{ tips: Tip[]; total: number }> {
    await this.ensureInitialized();

    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.category) {
      query.category = options.category;
    }
    if (options.tags?.length) {
      query.tags = { $all: options.tags };
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const skip = (page - 1) * limit;

    const [tips, total] = await Promise.all([
      this.tipsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.tipsCollection.countDocuments(query),
    ]);

    return { tips, total };
  }

  async incrementViews(tipId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    const result = await this.tipsCollection.updateOne(
      { _id: tipId },
      {
        $inc: { views: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Tip not found');
    }
  }

  async likeTip(tipId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    const result = await this.tipsCollection.updateOne(
      { _id: tipId },
      {
        $inc: { likes: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Tip not found');
    }
  }

  async unlikeTip(tipId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    const result = await this.tipsCollection.updateOne(
      { _id: tipId },
      {
        $inc: { likes: -1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Tip not found');
    }
  }

  async getPopularTips(limit: number = 10): Promise<Tip[]> {
    await this.ensureInitialized();

    return this.tipsCollection
      .find({ status: 'published' })
      .sort({ views: -1, likes: -1 })
      .limit(limit)
      .toArray();
  }

  async searchTips(query: string, limit: number = 10): Promise<Tip[]> {
    await this.ensureInitialized();

    return this.tipsCollection
      .find({
        status: 'published',
        $text: { $search: query },
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray();
  }
}

export const tipService = TipsService.getInstance();

import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
export class TipsService {
    constructor() {
        this.initialized = false;
        this.db = DatabaseService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize TipsService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.connect();
            this.tipsCollection = this.db.getCollection('tips');
            this.initialized = true;
            logger.info('TipsService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize TipsService:', error);
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!TipsService.instance) {
            TipsService.instance = new TipsService();
        }
        return TipsService.instance;
    }
    async createTip(data) {
        await this.ensureInitialized();
        const now = new Date();
        const tip = {
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
    async getTip(tipId) {
        await this.ensureInitialized();
        const tip = await this.tipsCollection.findOne({ _id: tipId });
        if (!tip) {
            throw new NotFoundError('Tip not found');
        }
        return tip;
    }
    async updateTip(tipId, updates) {
        await this.ensureInitialized();
        const result = await this.tipsCollection.findOneAndUpdate({ _id: tipId }, {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        if (!result.value) {
            throw new NotFoundError('Tip not found');
        }
        return result.value;
    }
    async deleteTip(tipId) {
        await this.ensureInitialized();
        const result = await this.tipsCollection.deleteOne({ _id: tipId });
        if (result.deletedCount === 0) {
            throw new NotFoundError('Tip not found');
        }
    }
    async getTips(options = {}) {
        await this.ensureInitialized();
        const query = {};
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
    async incrementViews(tipId) {
        await this.ensureInitialized();
        const result = await this.tipsCollection.updateOne({ _id: tipId }, {
            $inc: { views: 1 },
            $set: { updatedAt: new Date() },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Tip not found');
        }
    }
    async likeTip(tipId) {
        await this.ensureInitialized();
        const result = await this.tipsCollection.updateOne({ _id: tipId }, {
            $inc: { likes: 1 },
            $set: { updatedAt: new Date() },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Tip not found');
        }
    }
    async unlikeTip(tipId) {
        await this.ensureInitialized();
        const result = await this.tipsCollection.updateOne({ _id: tipId }, {
            $inc: { likes: -1 },
            $set: { updatedAt: new Date() },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Tip not found');
        }
    }
    async getPopularTips(limit = 10) {
        await this.ensureInitialized();
        return this.tipsCollection
            .find({ status: 'published' })
            .sort({ views: -1, likes: -1 })
            .limit(limit)
            .toArray();
    }
    async searchTips(query, limit = 10) {
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
//# sourceMappingURL=tips.service.js.map
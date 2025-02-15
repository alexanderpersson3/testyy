import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db/db.js';
import { logger } from '../logging.service.js';
import { cache } from '../cache.service.js';
import { SponsorDeal, DealMetrics, Sponsor } from '../types/sponsor.js';
import { DatabaseService } from '../db/database.service.js';
import { CacheService } from '../cache.service.js';
import { LanguageCode } from '../types/language.js';
export class SponsorService {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour
        this.db = DatabaseService.getInstance();
        this.cache = CacheService.getInstance();
    }
    static getInstance() {
        if (!SponsorService.instance) {
            SponsorService.instance = new SponsorService();
        }
        return SponsorService.instance;
    }
    /**
     * Create a new sponsor
     */
    async createSponsor(data) {
        const db = await connectToDatabase();
        const sponsor = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('sponsors').insertOne(sponsor);
        return { ...sponsor, _id: result.insertedId };
    }
    /**
     * Create a new sponsor deal
     */
    async createDeal(deal) {
        await connectToDatabase();
        const result = await getCollection('sponsor_deals').insertOne({
            ...deal,
            _id: new ObjectId(),
            metrics: { views: 0, clicks: 0, conversions: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return {
            ...deal,
            _id: result.insertedId,
            metrics: { views: 0, clicks: 0, conversions: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /**
     * Get active deals for ingredients
     */
    async getDealsForIngredients(ingredientIds) {
        const db = await connectToDatabase();
        const now = new Date();
        return await db
            .collection('sponsor_deals')
            .find({
            ingredientIds: { $in: ingredientIds.map(id => new ObjectId(id)) },
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gt: now },
        })
            .sort({ priority: -1 })
            .toArray();
    }
    /**
     * Get active deals for recipes
     */
    async getDealsForRecipes(recipeIds) {
        const db = await connectToDatabase();
        const now = new Date();
        return await db
            .collection('sponsor_deals')
            .find({
            recipeIds: { $in: recipeIds.map(id => new ObjectId(id)) },
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gt: now },
        })
            .sort({ priority: -1 })
            .toArray();
    }
    /**
     * Track deal view
     */
    async trackView(dealId) {
        const db = await connectToDatabase();
        const deal = await db.collection('sponsor_deals').findOne({
            _id: new ObjectId(dealId),
        });
        if (!deal)
            return;
        await Promise.all([
            // Update deal metrics
            db
                .collection('sponsor_deals')
                .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.views': 1 } }),
            // Update sponsor metrics
            db
                .collection('sponsors')
                .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalViews': 1 } }),
        ]);
    }
    /**
     * Track deal click
     */
    async trackClick(dealId) {
        const db = await connectToDatabase();
        const deal = await db.collection('sponsor_deals').findOne({
            _id: new ObjectId(dealId),
        });
        if (!deal)
            return;
        await Promise.all([
            // Update deal metrics
            db
                .collection('sponsor_deals')
                .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.clicks': 1 } }),
            // Update sponsor metrics
            db
                .collection('sponsors')
                .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalClicks': 1 } }),
        ]);
    }
    /**
     * Track deal conversion
     */
    async trackConversion(dealId) {
        const db = await connectToDatabase();
        const deal = await db.collection('sponsor_deals').findOne({
            _id: new ObjectId(dealId),
        });
        if (!deal)
            return;
        await Promise.all([
            // Update deal metrics
            db
                .collection('sponsor_deals')
                .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.conversions': 1 } }),
            // Update sponsor metrics
            db
                .collection('sponsors')
                .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalConversions': 1 } }),
        ]);
    }
    /**
     * Get sponsor metrics
     */
    async getSponsorMetrics(sponsorId, startDate, endDate) {
        const db = await connectToDatabase();
        const deals = await db
            .collection('sponsor_deals')
            .find({
            sponsorId: new ObjectId(sponsorId),
            createdAt: { $gte: startDate, $lte: endDate },
        })
            .toArray();
        return {
            views: deals.reduce((sum, deal) => sum + deal.metrics.views, 0),
            clicks: deals.reduce((sum, deal) => sum + deal.metrics.clicks, 0),
            conversions: deals.reduce((sum, deal) => sum + deal.metrics.conversions, 0),
            deals: deals.map(deal => ({
                dealId: deal._id,
                title: deal.title,
                views: deal.metrics.views,
                clicks: deal.metrics.clicks,
                conversions: deal.metrics.conversions,
            })),
        };
    }
    async updateDeal(dealId, update) {
        await connectToDatabase();
        await getCollection('sponsor_deals').updateOne({ _id: new ObjectId(dealId) }, {
            $set: {
                ...update,
                updatedAt: new Date(),
            },
        });
    }
    async getDeal(dealId) {
        await connectToDatabase();
        return getCollection('sponsor_deals').findOne({ _id: new ObjectId(dealId) });
    }
    async listDeals(sponsorId) {
        await connectToDatabase();
        return getCollection('sponsor_deals')
            .find({ sponsorId: new ObjectId(sponsorId) })
            .toArray();
    }
    async deleteDeal(dealId) {
        await connectToDatabase();
        await getCollection('sponsor_deals').deleteOne({ _id: new ObjectId(dealId) });
    }
    async getDealStats(sponsorId) {
        await connectToDatabase();
        const deals = await getCollection('sponsor_deals')
            .find({ sponsorId: new ObjectId(sponsorId) })
            .toArray();
        return {
            views: deals.reduce((sum, deal) => sum + (deal.metrics?.views || 0), 0),
            clicks: deals.reduce((sum, deal) => sum + (deal.metrics?.clicks || 0), 0),
            conversions: deals.reduce((sum, deal) => sum + (deal.metrics?.conversions || 0), 0),
            deals: deals.map((deal) => ({
                ...deal,
                metrics: deal.metrics || { views: 0, clicks: 0, conversions: 0 },
            })),
        };
    }
    /**
     * Get sponsored recipes
     */
    async getSponsoredRecipes(limit = 5) {
        try {
            const cacheKey = `sponsored_recipes:${limit}`;
            // Try to get from cache first
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            // Mock data for now
            const mockRecipes = [
                {
                    _id: new ObjectId(),
                    userId: new ObjectId(),
                    isSponsored: true,
                    sponsorId: new ObjectId(),
                    sponsorshipEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                    name: 'Sponsored Recipe',
                    title: 'Sponsored Recipe',
                    description: 'A sponsored recipe',
                    ingredients: [],
                    instructions: [],
                    servings: 4,
                    prepTime: 30,
                    cookTime: 30,
                    totalTime: 60,
                    difficulty: 'medium',
                    cuisine: 'International',
                    tags: ['sponsored'],
                    images: [],
                    isPrivate: false,
                    isPro: false,
                    creatorTips: [],
                    categories: ['sponsored'],
                    defaultLanguage: 'en',
                    availableLanguages: ['en'],
                    author: {
                        _id: new ObjectId(),
                        name: 'Sponsor',
                    },
                    ratings: {
                        average: 4.5,
                        count: 10,
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];
            // Cache the results
            await this.cache.set(cacheKey, mockRecipes, { ttl: 3600 });
            return mockRecipes;
        }
        catch (error) {
            logger.error('Error getting sponsored recipes:', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }
}
export const sponsorService = SponsorService.getInstance();
//# sourceMappingURL=sponsor.service.js.map
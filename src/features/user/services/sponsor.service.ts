;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import type { getCollection } from '../types/express.js';
import { connectToDatabase } from '../db/db.js';;
import { logger } from '../logging.service.js';;
import { cache } from '../cache.service.js';;
import { SponsorDeal, DealMetrics, Sponsor } from '../types/sponsor.js';;
import { DatabaseService } from '../db/database.service.js';;
import { CacheService } from '../cache.service.js';;
import type { Recipe } from '../types/express.js';
import { LanguageCode } from '../types/language.js';;

interface SponsoredRecipe extends Omit<Recipe, '_id'> {
  _id?: ObjectId;
  isSponsored: boolean;
  sponsorId: ObjectId;
  sponsorshipEnds: Date;
}

export class SponsorService {
  private static instance: SponsorService;
  private db: DatabaseService;
  private cache: CacheService;
  private readonly CACHE_TTL = 3600; // 1 hour

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.cache = CacheService.getInstance();
  }

  static getInstance(): SponsorService {
    if (!SponsorService.instance) {
      SponsorService.instance = new SponsorService();
    }
    return SponsorService.instance;
  }

  /**
   * Create a new sponsor
   */
  async createSponsor(data: Omit<Sponsor, '_id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor> {
    const db = await connectToDatabase();

    const sponsor: Omit<Sponsor, '_id'> = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection<Sponsor>('sponsors').insertOne(sponsor);
    return { ...sponsor, _id: result.insertedId };
  }

  /**
   * Create a new sponsor deal
   */
  async createDeal(
    deal: Omit<SponsorDeal, '_id' | 'metrics' | 'createdAt' | 'updatedAt'>
  ): Promise<SponsorDeal> {
    await connectToDatabase();
    const result = await getCollection<SponsorDeal>('sponsor_deals').insertOne({
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
  async getDealsForIngredients(ingredientIds: string[]): Promise<SponsorDeal[]> {
    const db = await connectToDatabase();
    const now = new Date();

    return await db
      .collection<SponsorDeal>('sponsor_deals')
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
  async getDealsForRecipes(recipeIds: string[]): Promise<SponsorDeal[]> {
    const db = await connectToDatabase();
    const now = new Date();

    return await db
      .collection<SponsorDeal>('sponsor_deals')
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
  async trackView(dealId: string): Promise<void> {
    const db = await connectToDatabase();

    const deal = await db.collection<SponsorDeal>('sponsor_deals').findOne({
      _id: new ObjectId(dealId),
    });

    if (!deal) return;

    await Promise.all([
      // Update deal metrics
      db
        .collection<SponsorDeal>('sponsor_deals')
        .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.views': 1 } }),
      // Update sponsor metrics
      db
        .collection<Sponsor>('sponsors')
        .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalViews': 1 } }),
    ]);
  }

  /**
   * Track deal click
   */
  async trackClick(dealId: string): Promise<void> {
    const db = await connectToDatabase();

    const deal = await db.collection<SponsorDeal>('sponsor_deals').findOne({
      _id: new ObjectId(dealId),
    });

    if (!deal) return;

    await Promise.all([
      // Update deal metrics
      db
        .collection<SponsorDeal>('sponsor_deals')
        .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.clicks': 1 } }),
      // Update sponsor metrics
      db
        .collection<Sponsor>('sponsors')
        .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalClicks': 1 } }),
    ]);
  }

  /**
   * Track deal conversion
   */
  async trackConversion(dealId: string): Promise<void> {
    const db = await connectToDatabase();

    const deal = await db.collection<SponsorDeal>('sponsor_deals').findOne({
      _id: new ObjectId(dealId),
    });

    if (!deal) return;

    await Promise.all([
      // Update deal metrics
      db
        .collection<SponsorDeal>('sponsor_deals')
        .updateOne({ _id: new ObjectId(dealId) }, { $inc: { 'metrics.conversions': 1 } }),
      // Update sponsor metrics
      db
        .collection<Sponsor>('sponsors')
        .updateOne({ _id: deal.sponsorId }, { $inc: { 'metrics.totalConversions': 1 } }),
    ]);
  }

  /**
   * Get sponsor metrics
   */
  async getSponsorMetrics(
    sponsorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    views: number;
    clicks: number;
    conversions: number;
    deals: Array<{
      dealId: ObjectId;
      title: string;
      views: number;
      clicks: number;
      conversions: number;
    }>;
  }> {
    const db = await connectToDatabase();

    const deals = await db
      .collection<SponsorDeal>('sponsor_deals')
      .find({
        sponsorId: new ObjectId(sponsorId),
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    return {
      views: deals.reduce((sum: any, deal: any) => sum + deal.metrics.views, 0),
      clicks: deals.reduce((sum: any, deal: any) => sum + deal.metrics.clicks, 0),
      conversions: deals.reduce((sum: any, deal: any) => sum + deal.metrics.conversions, 0),
      deals: deals.map(deal => ({
        dealId: deal._id!,
        title: deal.title,
        views: deal.metrics.views,
        clicks: deal.metrics.clicks,
        conversions: deal.metrics.conversions,
      })),
    };
  }

  async updateDeal(dealId: string, update: Partial<SponsorDeal>): Promise<void> {
    await connectToDatabase();
    await getCollection<SponsorDeal>('sponsor_deals').updateOne(
      { _id: new ObjectId(dealId) },
      {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      }
    );
  }

  async getDeal(dealId: string): Promise<SponsorDeal | null> {
    await connectToDatabase();
    return getCollection<SponsorDeal>('sponsor_deals').findOne({ _id: new ObjectId(dealId) });
  }

  async listDeals(sponsorId: string): Promise<SponsorDeal[]> {
    await connectToDatabase();
    return getCollection<SponsorDeal>('sponsor_deals')
      .find({ sponsorId: new ObjectId(sponsorId) })
      .toArray();
  }

  async deleteDeal(dealId: string): Promise<void> {
    await connectToDatabase();
    await getCollection<SponsorDeal>('sponsor_deals').deleteOne({ _id: new ObjectId(dealId) });
  }

  async getDealStats(sponsorId: string): Promise<{
    views: number;
    clicks: number;
    conversions: number;
    deals: Array<SponsorDeal & { metrics: DealMetrics }>;
  }> {
    await connectToDatabase();
    const deals = await getCollection<SponsorDeal>('sponsor_deals')
      .find({ sponsorId: new ObjectId(sponsorId) })
      .toArray();

    return {
      views: deals.reduce((sum: number, deal: SponsorDeal) => sum + (deal.metrics?.views || 0), 0),
      clicks: deals.reduce(
        (sum: number, deal: SponsorDeal) => sum + (deal.metrics?.clicks || 0),
        0
      ),
      conversions: deals.reduce(
        (sum: number, deal: SponsorDeal) => sum + (deal.metrics?.conversions || 0),
        0
      ),
      deals: deals.map((deal: SponsorDeal) => ({
        ...deal,
        metrics: deal.metrics || { views: 0, clicks: 0, conversions: 0 },
      })),
    };
  }

  /**
   * Get sponsored recipes
   */
  async getSponsoredRecipes(limit: number = 5): Promise<SponsoredRecipe[]> {
    try {
      const cacheKey = `sponsored_recipes:${limit}`;

      // Try to get from cache first
      const cached = await this.cache.get<SponsoredRecipe[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Mock data for now
      const mockRecipes: SponsoredRecipe[] = [
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
          defaultLanguage: 'en' as LanguageCode,
          availableLanguages: ['en'] as LanguageCode[],
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
    } catch (error) {
      logger.error(
        'Error getting sponsored recipes:',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }
}

export const sponsorService = SponsorService.getInstance();

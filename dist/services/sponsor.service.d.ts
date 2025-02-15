import { ObjectId } from 'mongodb';
import { SponsorDeal, DealMetrics, Sponsor } from '../types/sponsor.js';
import type { Recipe } from '../types/index.js';
interface SponsoredRecipe extends Omit<Recipe, '_id'> {
    _id?: ObjectId;
    isSponsored: boolean;
    sponsorId: ObjectId;
    sponsorshipEnds: Date;
}
export declare class SponsorService {
    private static instance;
    private db;
    private cache;
    private readonly CACHE_TTL;
    private constructor();
    static getInstance(): SponsorService;
    /**
     * Create a new sponsor
     */
    createSponsor(data: Omit<Sponsor, '_id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor>;
    /**
     * Create a new sponsor deal
     */
    createDeal(deal: Omit<SponsorDeal, '_id' | 'metrics' | 'createdAt' | 'updatedAt'>): Promise<SponsorDeal>;
    /**
     * Get active deals for ingredients
     */
    getDealsForIngredients(ingredientIds: string[]): Promise<SponsorDeal[]>;
    /**
     * Get active deals for recipes
     */
    getDealsForRecipes(recipeIds: string[]): Promise<SponsorDeal[]>;
    /**
     * Track deal view
     */
    trackView(dealId: string): Promise<void>;
    /**
     * Track deal click
     */
    trackClick(dealId: string): Promise<void>;
    /**
     * Track deal conversion
     */
    trackConversion(dealId: string): Promise<void>;
    /**
     * Get sponsor metrics
     */
    getSponsorMetrics(sponsorId: string, startDate: Date, endDate: Date): Promise<{
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
    }>;
    updateDeal(dealId: string, update: Partial<SponsorDeal>): Promise<void>;
    getDeal(dealId: string): Promise<SponsorDeal | null>;
    listDeals(sponsorId: string): Promise<SponsorDeal[]>;
    deleteDeal(dealId: string): Promise<void>;
    getDealStats(sponsorId: string): Promise<{
        views: number;
        clicks: number;
        conversions: number;
        deals: Array<SponsorDeal & {
            metrics: DealMetrics;
        }>;
    }>;
    /**
     * Get sponsored recipes
     */
    getSponsoredRecipes(limit?: number): Promise<SponsoredRecipe[]>;
}
export declare const sponsorService: SponsorService;
export {};

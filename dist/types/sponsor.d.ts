import { ObjectId } from 'mongodb';
export interface DealMetrics {
    views: number;
    clicks: number;
    conversions: number;
}
export interface SponsorDeal {
    _id?: ObjectId;
    sponsorId: ObjectId;
    title: string;
    description: string;
    ingredientIds: ObjectId[];
    recipeIds: ObjectId[];
    type: 'highlight' | 'discount' | 'promotion';
    discount?: {
        amount: number;
        type: 'percentage' | 'fixed';
        currency?: string;
    };
    startDate: Date;
    endDate: Date;
    priority: number;
    status: 'draft' | 'active' | 'expired' | 'cancelled';
    metrics: DealMetrics;
    createdAt: Date;
    updatedAt: Date;
}
export interface Sponsor {
    _id?: ObjectId;
    name: string;
    description: string;
    logo: string;
    website: string;
    contactEmail: string;
    status: 'active' | 'inactive';
    tier: 'basic' | 'premium' | 'enterprise';
    settings: {
        maxDeals: number;
        maxHighlightedItems: number;
        allowedTypes: ('highlight' | 'discount' | 'promotion')[];
    };
    metrics: {
        totalViews: number;
        totalClicks: number;
        totalConversions: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

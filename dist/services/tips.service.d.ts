import type { ObjectId } from '../types/index.js';
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
export declare class TipsService {
    private static instance;
    private initialized;
    private db;
    private tipsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): TipsService;
    createTip(data: CreateTipDTO): Promise<Tip>;
    getTip(tipId: ObjectId): Promise<Tip>;
    updateTip(tipId: ObjectId, updates: UpdateTipDTO): Promise<Tip>;
    deleteTip(tipId: ObjectId): Promise<void>;
    getTips(options?: {
        status?: TipStatus;
        category?: TipCategory;
        tags?: string[];
        page?: number;
        limit?: number;
    }): Promise<{
        tips: Tip[];
        total: number;
    }>;
    incrementViews(tipId: ObjectId): Promise<void>;
    likeTip(tipId: ObjectId): Promise<void>;
    unlikeTip(tipId: ObjectId): Promise<void>;
    getPopularTips(limit?: number): Promise<Tip[]>;
    searchTips(query: string, limit?: number): Promise<Tip[]>;
}
export declare const tipService: TipsService;

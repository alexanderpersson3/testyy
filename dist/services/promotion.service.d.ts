interface Promotion {
    _id: ObjectId;
    userId: ObjectId;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    discountPercentage: number;
    itemId: ObjectId;
    itemType: 'recipe' | 'ingredient';
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
}
interface CreatePromotionDTO {
    userId: ObjectId;
    title: string;
    description: string;
    startDate: string | Date;
    endDate: string | Date;
    discountPercentage: number;
    itemId: ObjectId;
    itemType: 'recipe' | 'ingredient';
}
export declare class PromotionService {
    private static instance;
    private initialized;
    private db;
    private promotionsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): PromotionService;
    getActivePromotions(userId: ObjectId): Promise<Promotion[]>;
    getPromotionById(promotionId: ObjectId, userId: ObjectId): Promise<Promotion | null>;
    createPromotion(data: CreatePromotionDTO): Promise<Promotion>;
    updatePromotion(promotionId: ObjectId, userId: ObjectId, updates: Partial<Promotion>): Promise<Promotion | null>;
    deletePromotion(promotionId: ObjectId, userId: ObjectId): Promise<boolean>;
}
export {};

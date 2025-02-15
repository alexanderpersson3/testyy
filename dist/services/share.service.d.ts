import { ObjectId } from 'mongodb';
export interface RecipeShare {
    _id?: ObjectId;
    recipeId: ObjectId;
    sharedBy: ObjectId;
    sharedWith: ObjectId;
    message?: string;
    visibility: 'public' | 'private';
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
    updatedAt: Date;
}
export interface ShareRecipeInput {
    recipeId: ObjectId;
    sharedBy: ObjectId;
    sharedWith: ObjectId;
    message?: string;
    visibility?: 'public' | 'private';
}
export interface ShareRecipeMultipleInput {
    recipeId: ObjectId;
    sharedBy: ObjectId;
    sharedWith: ObjectId[];
    message?: string;
    visibility?: 'public' | 'private';
}
export declare class ShareService {
    private static instance;
    private initialized;
    private db;
    private notificationService;
    private constructor();
    static getInstance(): ShareService;
    private initialize;
    private ensureInitialized;
    shareRecipe(input: ShareRecipeInput): Promise<RecipeShare>;
    shareRecipeWithMultiple(input: ShareRecipeMultipleInput): Promise<RecipeShare[]>;
    getRecipeShares(recipeId: ObjectId, userId: ObjectId, isAuthor: boolean): Promise<RecipeShare[]>;
    acceptShare(shareId: ObjectId, userId: ObjectId): Promise<void>;
    rejectShare(shareId: ObjectId, userId: ObjectId): Promise<void>;
}

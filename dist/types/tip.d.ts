export declare enum TipCategory {
    INGREDIENT = "ingredient",
    TECHNIQUE = "technique",
    TIMING = "timing",
    EQUIPMENT = "equipment",
    GENERAL = "general"
}
export interface TipInput {
    title: string;
    content: string;
    category: TipCategory;
    recipeId?: ObjectId;
    position?: number;
    isActive?: boolean;
}
export interface Tip extends TipInput {
    _id?: ObjectId;
    userId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export interface TipDocument extends TipInput {
    _id: ObjectId;
}
export interface CreateTipDTO {
    title: string;
    content: string;
    category: TipCategory;
    position?: number;
}
export interface UpdateTipDTO {
    title?: string;
    content?: string;
    category?: TipCategory;
    position?: number;
    isActive?: boolean;
}
export interface TipQuery {
    recipeId: string;
    category?: TipCategory;
    isActive?: boolean;
}

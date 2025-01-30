import { ObjectId } from 'mongodb';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DietType = 'any' | 'vegetarian' | 'vegan' | 'glutenFree' | 'dairyFree' | 'keto' | 'paleo';
export type PriceRange = 'budget' | 'moderate' | 'expensive';
export type MediaType = 'image' | 'video';
export type RecipeStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export interface RecipeIngredient {
    ingredientId: string;
    name: string;
    amount: number;
    unit: string;
    image?: string;
}
export interface RecipeInstruction {
    step: number;
    text: string;
    image?: string;
}
export interface RecipeDetails {
    _id: ObjectId;
    title: string;
    description: string;
    ingredients: RecipeIngredient[];
    instructions: RecipeInstruction[];
    cookingTime: number;
    servings: number;
    difficulty: 'easy' | 'medium' | 'hard';
    cuisine?: string;
    tags: string[];
    image?: string;
    userId: ObjectId;
    isPrivate: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IngredientPrice {
    ingredientId: string;
    storeId: string;
    store: string;
    price: number;
    oldPrice?: number;
    currency: string;
    unit: string;
    lastUpdated: Date;
}
export interface StorePriceIngredient {
    name: string;
    amount: number;
    unit: string;
    image?: string;
    newPrice: number | null;
    oldPrice: number | null;
    store: string | null;
}
export interface StorePriceResponse {
    success: boolean;
    data: {
        store: string;
        storeLogo: string | null;
        ingredients: StorePriceIngredient[];
        totalPrice: number;
        oldTotalPrice: number;
        ingredientsFound: number;
        totalIngredientsNeeded: number;
    };
}
export interface BaseRecipe {
    name: string;
    description: string;
    servings: number;
    prepTime: number;
    cookTime: number;
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
        notes?: string;
    }>;
    instructions: Array<{
        step: number;
        text: string;
        image?: string;
    }>;
    tags: string[];
    categories: string[];
    difficulty: Difficulty;
    cuisine?: string;
    image?: string;
    isPrivate: boolean;
    isPro: boolean;
    likes: number;
    shares: number;
    rating?: {
        average: number;
        count: number;
    };
    status?: 'draft' | 'published' | 'archived';
    notes?: string;
    userId: ObjectId;
    remixedFrom?: {
        recipeId: ObjectId;
        userId: ObjectId;
    };
    createdAt: Date;
    updatedAt: Date;
    nutritionalInfo?: NutritionalInfo;
    estimatedCost?: {
        amount: number;
        currency: string;
        lastUpdated: Date;
    };
}
export interface Recipe extends BaseRecipe {
    _id?: ObjectId;
    authorId: ObjectId;
    source?: 'url_import' | 'file_import' | 'image_import' | 'pdf_import';
    sourceUrl?: string;
}
export interface RecipeDocument extends BaseRecipe {
    _id: ObjectId;
}
export interface RecipeInput extends Omit<BaseRecipe, 'userId' | 'likes' | 'shares' | 'createdAt' | 'updatedAt' | 'rating'> {
    userId?: ObjectId;
}
export interface RecipeUpdate extends Partial<Omit<BaseRecipe, 'userId' | 'likes' | 'shares' | 'createdAt' | 'updatedAt' | 'rating'>> {
    updatedAt?: Date;
}
export interface RecipeMedia {
    _id?: ObjectId;
    recipeId: ObjectId;
    userId: ObjectId;
    mediaUrl: string;
    mediaType: MediaType;
    isPrimary: boolean;
    createdAt: Date;
}
export interface RecipeReview {
    _id?: ObjectId;
    recipeId: ObjectId;
    userId: ObjectId;
    rating: number;
    comment?: string;
    media?: {
        mediaUrl: string;
        mediaType: MediaType;
    }[];
    likes: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeSearchQuery {
    query?: string;
    difficulty?: Difficulty[];
    maxCookTime?: number;
    dietType?: DietType[];
    priceRange?: PriceRange[];
    rating?: number;
    sortBy?: 'rating' | 'cookTime' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface RecipeFilterOptions {
    difficulty?: Difficulty[];
    dietType?: DietType[];
    priceRange?: PriceRange[];
    cookTime?: {
        min?: number;
        max?: number;
    };
    rating?: {
        min?: number;
    };
}
export interface BaseRecipeCategory {
    name: string;
    slug: string;
    description?: string;
    image?: string;
    parentId?: ObjectId;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeCategory extends BaseRecipeCategory {
    _id?: ObjectId;
}
export interface RecipeCategoryDocument extends BaseRecipeCategory {
    _id: ObjectId;
}
export interface BaseRecipeCollection {
    userId: ObjectId;
    name: string;
    description?: string;
    image?: string;
    isPrivate: boolean;
    recipeIds: ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeCollection extends BaseRecipeCollection {
    _id?: ObjectId;
}
export interface RecipeCollectionDocument extends BaseRecipeCollection {
    _id: ObjectId;
}
export interface BaseRecipeComment {
    recipeId: ObjectId;
    userId: ObjectId;
    parentId?: ObjectId;
    text: string;
    likes: number;
    isEdited: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeComment extends BaseRecipeComment {
    _id?: ObjectId;
}
export interface RecipeCommentDocument extends BaseRecipeComment {
    _id: ObjectId;
}
export interface BaseRecipeRating {
    recipeId: ObjectId;
    userId: ObjectId;
    rating: number;
    review?: string;
    isVerifiedPurchase?: boolean;
    helpfulVotes: number;
    unhelpfulVotes: number;
    votedUserIds: ObjectId[];
    authorResponse?: {
        text: string;
        createdAt: Date;
        updatedAt: Date;
    };
    status: 'active' | 'flagged' | 'removed';
    flags: Array<{
        userId: ObjectId;
        reason: string;
        createdAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeRating extends BaseRecipeRating {
    _id?: ObjectId;
}
export interface RecipeRatingDocument extends BaseRecipeRating {
    _id: ObjectId;
}
export interface BaseShoppingList {
    userId: ObjectId;
    name: string;
    description?: string;
    items: Array<{
        name: string;
        amount: number;
        unit: string;
        notes?: string;
        recipeId?: ObjectId;
        isChecked: boolean;
        category?: string;
    }>;
    recipeIds: ObjectId[];
    servingsMultiplier: Record<string, number>;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ShoppingList extends BaseShoppingList {
    _id?: ObjectId;
}
export interface ShoppingListDocument extends BaseShoppingList {
    _id: ObjectId;
}
export interface NutritionalGoals {
    calories?: {
        min: number;
        max: number;
    };
    macros?: {
        protein?: {
            min: number;
            max: number;
        };
        carbs?: {
            min: number;
            max: number;
        };
        fat?: {
            min: number;
            max: number;
        };
    };
    fiber?: {
        min: number;
        max: number;
    };
    sodium?: {
        min: number;
        max: number;
    };
}
export interface UserSettings {
    nutritionalGoals?: NutritionalGoals;
    mealPlanPreferences?: {
        defaultServings: number;
        excludedIngredients: string[];
        preferredCuisines: string[];
        dietaryRestrictions: string[];
    };
}
export interface MealPlan {
    _id?: ObjectId;
    userId: ObjectId;
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    meals: Array<{
        date: Date;
        recipeId: ObjectId;
        servings: number;
        mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        notes?: string;
        nutritionalInfo?: NutritionalInfo;
    }>;
    nutritionalGoals?: NutritionalGoals;
    shoppingListId?: ObjectId;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    dailyNutritionalSummary?: {
        [date: string]: {
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
            fiber: number;
            sodium: number;
            meetsGoals: boolean;
            warnings: string[];
        };
    };
}
export interface MealPlanDocument extends MealPlan {
    _id: ObjectId;
}
export interface NutritionalInfo {
    servingSize: string;
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
}
//# sourceMappingURL=recipe.d.ts.map
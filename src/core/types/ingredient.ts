import { ObjectId } from 'mongodb';;;;
export type IngredientSource = 'matspar' | 'user' | 'system';

export interface NutritionalInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sodium?: number;
  unit: 'per100g' | 'per100ml';
}

export interface CustomPrice {
  amount: number;
  currency: string;
  quantity: number;
  unit: string;
  updatedAt: Date;
}

export interface BaseIngredient {
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  tags: string[];
  nutritionalInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
  };
  allergens?: string[];
  dietaryInfo?: {
    isVegan: boolean;
    isVegetarian: boolean;
    isGlutenFree: boolean;
    isDairyFree: boolean;
  };
  source: IngredientSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ingredient extends BaseIngredient {
  _id?: ObjectId;
  createdBy?: ObjectId;
  verifiedBy?: ObjectId;
  verifiedAt?: Date;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  priceHistory?: Array<{
    price: number;
    currency: string;
    store?: string;
    date: Date;
  }>;
}

export interface ScrapedIngredient {
  _id?: ObjectId;
  ingredientId: ObjectId;
  storeId: ObjectId;
  externalId?: string;
  price: number;
  oldPrice?: number;
  currency: string;
  quantity: number;
  unit: string;
  store: {
    name: string;
    logo?: string;
  };
  validFrom: Date;
  validTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  _id?: ObjectId;
  name: string;
  country: string;
  source: IngredientSource;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIngredientDTO
  extends Omit<BaseIngredient, 'source' | 'createdAt' | 'updatedAt'> {
  price?: {
    amount: number;
    currency: string;
    store?: string;
  };
}

export interface UpdateIngredientDTO
  extends Partial<Omit<BaseIngredient, 'source' | 'createdAt' | 'updatedAt'>> {
  price?: {
    amount: number;
    currency: string;
    store?: string;
  };
  isVerified?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  verifiedBy?: ObjectId;
  verifiedAt?: Date;
}

export interface SearchIngredientsQuery {
  query: string;
  source?: IngredientSource[];
  country?: string[];
  userId?: string;
  includePrivate?: boolean;
  limit?: number;
  offset?: number;
}

export interface IngredientWithPrices extends Ingredient {
  prices: Array<{
    store: {
      _id: ObjectId;
      name: string;
      logo?: string;
    };
    price: number;
    currency: string;
    quantity: number;
    unit: string;
    convertedPrice?: {
      amount: number;
      currency: string;
    };
  }>;
}

export interface IngredientSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  source?: IngredientSource;
  isVerified?: boolean;
  dietaryPreferences?: {
    vegan?: boolean;
    vegetarian?: boolean;
    glutenFree?: boolean;
    dairyFree?: boolean;
  };
  allergenFree?: string[];
  limit?: number;
  offset?: number;
}

export interface IngredientStats {
  totalIngredients: number;
  userSubmitted: number;
  verified: number;
  pendingVerification: number;
  byCategory: Record<string, number>;
  bySource: Record<IngredientSource, number>;
}

export interface CustomIngredient extends Omit<Ingredient, '_id' | 'source' | 'isVerified' | 'verifiedBy' | 'verifiedAt'> {
  userId: ObjectId;
  isCustom: true;
  customPrice?: number;
  store?: string;
}

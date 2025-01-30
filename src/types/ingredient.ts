import { ObjectId } from 'mongodb';

export type IngredientSource = 'matspar' | 'user' | 'germanScrape' | 'usScrape';

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

export interface Ingredient {
  _id?: ObjectId;
  name: string;
  source: 'user' | 'matspar' | 'system';
  sourceCountry: string;
  isPublic: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIngredientDTO {
  name: string;
  description?: string;
  imageUrl?: string;
  isPublic?: boolean;
  nutritionalInfo?: NutritionalInfo;
  customPrice?: Omit<CustomPrice, 'updatedAt'>;
}

export interface UpdateIngredientDTO {
  name?: string;
  description?: string;
  imageUrl?: string;
  isPublic?: boolean;
  nutritionalInfo?: NutritionalInfo;
  customPrice?: Omit<CustomPrice, 'updatedAt'>;
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
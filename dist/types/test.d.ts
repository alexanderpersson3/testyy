import type { Response } from '../types/index.js';
import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
export interface TestResponse extends Response {
    statusCode: number;
}
export interface TestDocument extends BaseDocument {
    createdAt: Date;
    updatedAt: Date;
}
export interface TestUser extends TestDocument {
    email: string;
    name: string;
    isPremium: boolean;
}
export interface TestProduct extends TestDocument {
    name: string;
    price: number;
    category: string;
    storeId: ObjectId;
}
export interface TestStore extends TestDocument {
    name: string;
    address: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
    };
    openingHours: {
        [key: string]: {
            open: string;
            close: string;
        };
    };
}
export interface TestRecipe extends TestDocument {
    title: string;
    description: string;
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
        ingredientId?: ObjectId;
    }>;
    instructions: Array<{
        step: number;
        text: string;
    }>;
    userId: ObjectId;
}
export interface TestShoppingList extends TestDocument {
    name: string;
    userId: ObjectId;
    items: Array<{
        ingredientId: ObjectId;
        name: string;
        amount: number;
        unit: string;
        checked: boolean;
    }>;
}
export interface TestSocialProfile extends TestDocument {
    userId: ObjectId;
    displayName: string;
    bio?: string;
    avatar?: string;
    stats: {
        followers: number;
        following: number;
        recipes: number;
    };
}
export interface TestBadge extends TestDocument {
    userId: ObjectId;
    badgeId: ObjectId;
    earnedAt: Date;
}
export interface TestSearchSuggestion {
    name: string;
    category: string;
}
export interface TestSearchProduct {
    name: string;
    price: number;
    category: string;
    storeId: ObjectId;
}
export interface TestSearchTerm {
    term: string;
    count: number;
}
export interface TestSearchCategory {
    _id: ObjectId;
    name: string;
}
export type TestDataInput<T> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;
export interface TestDatabase {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    cleanup(): Promise<void>;
    createTestUser(data: TestDataInput<TestUser>): Promise<TestUser>;
    createTestProduct(data: TestDataInput<TestProduct>): Promise<TestProduct>;
    createTestStore(data: TestDataInput<TestStore>): Promise<TestStore>;
    createTestRecipe(data: TestDataInput<TestRecipe>): Promise<TestRecipe>;
    createTestShoppingList(data: TestDataInput<TestShoppingList>): Promise<TestShoppingList>;
    createTestSocialProfile(data: TestDataInput<TestSocialProfile>): Promise<TestSocialProfile>;
    createTestBadge(data: TestDataInput<TestBadge>): Promise<TestBadge>;
}

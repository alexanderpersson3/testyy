import type { Response } from 'superagent';
import { ObjectId } from 'mongodb';
export interface TestResponse extends Response {
    statusCode: number;
}
export interface TestUser {
    _id: ObjectId;
    email: string;
    name: string;
    isPremium: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface TestProduct {
    _id: ObjectId;
    name: string;
    price: number;
    category: string;
    store: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TestStore {
    _id: ObjectId;
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
    createdAt: Date;
    updatedAt: Date;
}
export interface TestRecipe {
    _id: ObjectId;
    title: string;
    description: string;
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
    }>;
    instructions: Array<{
        step: number;
        text: string;
    }>;
    userId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export interface TestShoppingList {
    _id: ObjectId;
    name: string;
    userId: ObjectId;
    items: Array<{
        ingredientId: ObjectId;
        name: string;
        amount: number;
        unit: string;
        checked: boolean;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface TestSocialProfile {
    _id: ObjectId;
    userId: ObjectId;
    displayName: string;
    bio?: string;
    avatar?: string;
    stats: {
        followers: number;
        following: number;
        recipes: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface TestBadge {
    _id: ObjectId;
    userId: ObjectId;
    badgeId: string;
    earnedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface TestSearchSuggestion {
    name: string;
    category: string;
}
export interface TestSearchProduct {
    name: string;
    price: number;
    category: string;
    store: string;
}
export interface TestSearchTerm {
    term: string;
    count: number;
}
export interface TestSearchCategory {
    id: string;
    name: string;
}
export interface TestDatabase {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    cleanup(): Promise<void>;
    createTestUser(data: Partial<TestUser>): Promise<TestUser>;
    createTestProduct(data: Partial<TestProduct>): Promise<TestProduct>;
    createTestStore(data: Partial<TestStore>): Promise<TestStore>;
    createTestRecipe(data: Partial<TestRecipe>): Promise<TestRecipe>;
    createTestShoppingList(data: Partial<TestShoppingList>): Promise<TestShoppingList>;
    createTestSocialProfile(data: Partial<TestSocialProfile>): Promise<TestSocialProfile>;
    createTestBadge(data: Partial<TestBadge>): Promise<TestBadge>;
}
//# sourceMappingURL=test.d.ts.map
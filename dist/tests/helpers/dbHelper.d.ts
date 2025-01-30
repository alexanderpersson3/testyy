import { ObjectId } from 'mongodb';
export declare class TestDatabase {
    private static mongod;
    private static client;
    private static db;
    static connect(): Promise<void>;
    static disconnect(): Promise<void>;
    static cleanup(): Promise<void>;
    static createTestUser(data?: Partial<{
        email: string;
        name: string;
        isPremium: boolean;
    }>): Promise<any>;
    static updateUser(userId: ObjectId, data: Partial<{
        email: string;
        name: string;
        isPremium: boolean;
    }>): Promise<void>;
    static createTestProfile(userId: ObjectId): Promise<any>;
    static createTestRecipe(data: {
        title: string;
        author: ObjectId;
        ingredients: Array<{
            name: string;
            amount: number;
            unit: string;
        }>;
        instructions: string[];
        tags: string[];
    }): Promise<any>;
    static createTestStory(userId: ObjectId, data?: any): Promise<any>;
    static createTestStore(data?: any): Promise<any>;
    static updateStore(storeId: ObjectId, updates: any): Promise<void>;
    static createTestProduct(data?: any): Promise<any>;
}
//# sourceMappingURL=dbHelper.d.ts.map
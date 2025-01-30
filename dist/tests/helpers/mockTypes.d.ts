import { Document } from 'mongodb';
export type MockFn<T = any> = {
    (...args: any[]): Promise<T>;
    mockResolvedValue: (value: T) => void;
    mockRejectedValue: (error: any) => void;
    mockImplementation: (fn: (...args: any[]) => Promise<T>) => void;
    mock: {
        calls: any[][];
    };
};
export declare function createMockFn<T>(): MockFn<T>;
export type MockCollection = {
    findOne: MockFn<Document | null>;
    updateOne: MockFn<any>;
    find: MockFn<any>;
    insertOne: MockFn<any>;
    deleteOne: MockFn<any>;
    countDocuments: MockFn<number>;
    aggregate: MockFn<any[]>;
};
export declare const createMockCollection: () => MockCollection;
//# sourceMappingURL=mockTypes.d.ts.map
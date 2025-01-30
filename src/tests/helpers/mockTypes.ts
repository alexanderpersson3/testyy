import { Collection, Document, Filter, FindOptions, WithId } from 'mongodb';

export type MockFn<T = any> = {
  (...args: any[]): Promise<T>;
  mockResolvedValue: (value: T) => void;
  mockRejectedValue: (error: any) => void;
  mockImplementation: (fn: (...args: any[]) => Promise<T>) => void;
  mock: {
    calls: any[][];
  };
};

export function createMockFn<T>(): MockFn<T> {
  let implementation: ((...args: any[]) => Promise<T>) | null = null;
  const calls: any[][] = [];

  const fn = ((...args: any[]): Promise<T> => {
    calls.push(args);
    if (implementation) {
      return implementation(...args);
    }
    return Promise.resolve(undefined as any);
  }) as MockFn<T>;

  fn.mock = { calls };
  fn.mockResolvedValue = (value: T) => {
    implementation = () => Promise.resolve(value);
  };
  fn.mockRejectedValue = (error: any) => {
    implementation = () => Promise.reject(error);
  };
  fn.mockImplementation = (newImpl: (...args: any[]) => Promise<T>) => {
    implementation = newImpl;
  };

  return fn;
}

export type MockCollection = {
  findOne: MockFn<Document | null>;
  updateOne: MockFn<any>;
  find: MockFn<any>;
  insertOne: MockFn<any>;
  deleteOne: MockFn<any>;
  countDocuments: MockFn<number>;
  aggregate: MockFn<any[]>;
};

export const createMockCollection = (): MockCollection => ({
  findOne: createMockFn<Document | null>(),
  updateOne: createMockFn(),
  find: createMockFn(),
  insertOne: createMockFn(),
  deleteOne: createMockFn(),
  countDocuments: createMockFn<number>(),
  aggregate: createMockFn<any[]>()
}); 
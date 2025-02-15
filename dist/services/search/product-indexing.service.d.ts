import { ObjectId } from 'mongodb';
interface Product {
    _id: ObjectId;
    name: string;
    description: string;
    price: number;
    brand: string;
    categories: string[];
    rating: number;
    reviewCount: number;
    inStock: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class ProductIndexingService {
    private static instance;
    private readonly BATCH_SIZE;
    private db;
    private searchService;
    private constructor();
    static getInstance(): ProductIndexingService;
    /**
     * Initialize Elasticsearch index and reindex all products
     */
    initializeIndex(): Promise<void>;
    /**
     * Reindex all products
     */
    reindexAll(): Promise<void>;
    /**
     * Index a batch of products
     */
    private indexBatch;
    /**
     * Handle product updates
     */
    handleProductUpdate(productId: string, updates: Partial<Product>): Promise<void>;
    /**
     * Handle product deletion
     */
    handleProductDeletion(productId: string): Promise<void>;
    /**
     * Sync product with search index
     */
    syncProduct(product: Product): Promise<void>;
}
export {};

import { ObjectId } from 'mongodb';
import { Supplier, SupplierReview, Product, SpecialDeal, SupplierSearchQuery } from '../types/supplier.js';
export declare class SupplierService {
    private static instance;
    private constructor();
    static getInstance(): SupplierService;
    /**
     * Create a new supplier
     */
    createSupplier(supplier: Omit<Supplier, '_id' | 'createdAt' | 'updatedAt'>): Promise<Supplier>;
    /**
     * Update supplier
     */
    updateSupplier(supplierId: ObjectId, updates: Partial<Omit<Supplier, '_id' | 'createdAt' | 'updatedAt'>>): Promise<Supplier | null>;
    /**
     * Get supplier by ID
     */
    getSupplier(supplierId: ObjectId): Promise<Supplier | null>;
    /**
     * Search suppliers
     */
    searchSuppliers(query: SupplierSearchQuery): Promise<Supplier[]>;
    /**
     * Add product to supplier
     */
    addProduct(supplierId: ObjectId, product: Omit<Product, '_id'>): Promise<Product>;
    /**
     * Update product
     */
    updateProduct(supplierId: ObjectId, productId: ObjectId, updates: Partial<Omit<Product, '_id'>>): Promise<void>;
    /**
     * Add special deal
     */
    addSpecialDeal(supplierId: ObjectId, deal: Omit<SpecialDeal, '_id'>): Promise<SpecialDeal>;
    /**
     * Add review
     */
    addReview(review: Omit<SupplierReview, '_id' | 'createdAt' | 'updatedAt'>): Promise<SupplierReview>;
    /**
     * Get reviews for supplier
     */
    getReviews(supplierId: ObjectId, options?: {
        limit?: number;
        offset?: number;
        sortBy?: 'date' | 'rating' | 'helpful';
    }): Promise<SupplierReview[]>;
    /**
     * Mark review as helpful
     */
    markReviewHelpful(reviewId: ObjectId): Promise<void>;
    /**
     * Report review
     */
    reportReview(reviewId: ObjectId, reason: string): Promise<void>;
    /**
     * Verify supplier
     */
    verifySupplier(supplierId: ObjectId, verifiedBy: ObjectId, status: 'verified' | 'rejected', document: string, notes?: string): Promise<void>;
}

import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { Supplier, SupplierReview, Product, SpecialDeal, SupplierSearchQuery, Location, BusinessHours,  } from '../types/supplier.js';;

export class SupplierService {
  private static instance: SupplierService;

  private constructor() {}

  static getInstance(): SupplierService {
    if (!SupplierService.instance) {
      SupplierService.instance = new SupplierService();
    }
    return SupplierService.instance;
  }

  /**
   * Create a new supplier
   */
  async createSupplier(
    supplier: Omit<Supplier, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<Supplier> {
    const db = await connectToDatabase();

    const now = new Date();
    const newSupplier: Supplier = {
      ...supplier,
      verificationStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<Supplier>('suppliers').insertOne(newSupplier);
    return {
      ...newSupplier,
      _id: result.insertedId,
    };
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    supplierId: ObjectId,
    updates: Partial<Omit<Supplier, '_id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Supplier | null> {
    const db = await connectToDatabase();

    const existing = await this.getSupplier(supplierId);
    if (!existing) return null;

    const updated: Supplier = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await db.collection<Supplier>('suppliers').updateOne({ _id: supplierId }, { $set: updated });

    return updated;
  }

  /**
   * Get supplier by ID
   */
  async getSupplier(supplierId: ObjectId): Promise<Supplier | null> {
    const db = await connectToDatabase();
    return db.collection<Supplier>('suppliers').findOne({ _id: supplierId });
  }

  /**
   * Search suppliers
   */
  async searchSuppliers(query: SupplierSearchQuery): Promise<Supplier[]> {
    const db = await connectToDatabase();

    const filter: any = {};

    // Location-based search
    if (query.location) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.location.longitude, query.location.latitude],
          },
          $maxDistance: query.location.radius * 1000, // Convert km to meters
        },
      };
    }

    // Type filter
    if (query.type?.length) {
      filter.type = { $in: query.type };
    }

    // Product filter
    if (query.products?.length) {
      filter['products.name'] = { $in: query.products };
    }

    // Rating filter
    if (query.rating) {
      filter['rating.average'] = { $gte: query.rating };
    }

    // Verification status filter
    if (query.verificationStatus) {
      filter.verificationStatus = query.verificationStatus;
    }

    // Delivery options filter
    if (query.deliveryOptions) {
      if (query.deliveryOptions.pickup) {
        filter['deliveryOptions.pickup'] = true;
      }
      if (query.deliveryOptions.delivery) {
        filter['deliveryOptions.delivery'] = true;
      }
    }

    // Open now filter
    if (query.openNow) {
      const now = new Date();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const day = days[now.getDay()] as BusinessHours['day'];
      const time = now.toLocaleTimeString('en-US', { hour12: false });

      filter.businessHours = {
        $elemMatch: {
          day,
          isClosed: false,
          open: { $lte: time },
          close: { $gt: time },
        },
      };
    }

    // Special deals filter
    if (query.specialDeals) {
      const now = new Date();
      filter.specialDeals = {
        $elemMatch: {
          startDate: { $lte: now },
          endDate: { $gt: now },
        },
      };
    }

    // Execute query
    let cursor = db.collection<Supplier>('suppliers').find(filter);

    // Apply sorting
    if (query.sortBy) {
      switch (query.sortBy) {
        case 'distance':
          // Already sorted by distance if location filter is applied
          break;
        case 'rating':
          cursor = cursor.sort({ 'rating.average': -1 });
          break;
        case 'name':
          cursor = cursor.sort({ name: 1 });
          break;
      }
    }

    // Apply pagination
    if (query.offset) {
      cursor = cursor.skip(query.offset);
    }
    if (query.limit) {
      cursor = cursor.limit(query.limit);
    }

    return cursor.toArray();
  }

  /**
   * Add product to supplier
   */
  async addProduct(supplierId: ObjectId, product: Omit<Product, '_id'>): Promise<Product> {
    const db = await connectToDatabase();

    const productWithId: Product = {
      ...product,
      _id: new ObjectId(),
    };

    await db.collection<Supplier>('suppliers').updateOne(
      { _id: supplierId },
      {
        $push: { products: productWithId },
        $set: { updatedAt: new Date() },
      }
    );

    return productWithId;
  }

  /**
   * Update product
   */
  async updateProduct(
    supplierId: ObjectId,
    productId: ObjectId,
    updates: Partial<Omit<Product, '_id'>>
  ): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<Supplier>('suppliers').updateOne(
      { _id: supplierId, 'products._id': productId },
      {
        $set: {
          'products.$': {
            ...updates,
            _id: productId,
          },
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Add special deal
   */
  async addSpecialDeal(supplierId: ObjectId, deal: Omit<SpecialDeal, '_id'>): Promise<SpecialDeal> {
    const db = await connectToDatabase();

    const dealWithId: SpecialDeal = {
      ...deal,
      _id: new ObjectId(),
    };

    await db.collection<Supplier>('suppliers').updateOne(
      { _id: supplierId },
      {
        $push: { specialDeals: dealWithId },
        $set: { updatedAt: new Date() },
      }
    );

    return dealWithId;
  }

  /**
   * Add review
   */
  async addReview(
    review: Omit<SupplierReview, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<SupplierReview> {
    const db = await connectToDatabase();

    const now = new Date();
    const newReview: SupplierReview = {
      ...review,
      helpful: 0,
      reported: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<SupplierReview>('supplier_reviews').insertOne(newReview);

    // Update supplier rating
    const reviews = await db
      .collection<SupplierReview>('supplier_reviews')
      .find({ supplierId: review.supplierId })
      .toArray();

    const averageRating = reviews.reduce((sum: any, r: any) => sum + r.rating, 0) / reviews.length;

    await db.collection<Supplier>('suppliers').updateOne(
      { _id: review.supplierId },
      {
        $set: {
          'rating.average': averageRating,
          'rating.count': reviews.length,
          updatedAt: now,
        },
      }
    );

    return {
      ...newReview,
      _id: result.insertedId,
    };
  }

  /**
   * Get reviews for supplier
   */
  async getReviews(
    supplierId: ObjectId,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'date' | 'rating' | 'helpful';
    } = {}
  ): Promise<SupplierReview[]> {
    const db = await connectToDatabase();

    let cursor = db.collection<SupplierReview>('supplier_reviews').find({ supplierId });

    // Apply sorting
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'date':
          cursor = cursor.sort({ createdAt: -1 });
          break;
        case 'rating':
          cursor = cursor.sort({ rating: -1 });
          break;
        case 'helpful':
          cursor = cursor.sort({ helpful: -1 });
          break;
      }
    }

    // Apply pagination
    if (options.offset) {
      cursor = cursor.skip(options.offset);
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    return cursor.toArray();
  }

  /**
   * Mark review as helpful
   */
  async markReviewHelpful(reviewId: ObjectId): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<SupplierReview>('supplier_reviews').updateOne(
      { _id: reviewId },
      {
        $inc: { helpful: 1 },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Report review
   */
  async reportReview(reviewId: ObjectId, reason: string): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<SupplierReview>('supplier_reviews').updateOne(
      { _id: reviewId },
      {
        $set: {
          reported: true,
          reportReason: reason,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Verify supplier
   */
  async verifySupplier(
    supplierId: ObjectId,
    verifiedBy: ObjectId,
    status: 'verified' | 'rejected',
    document: string,
    notes?: string
  ): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<Supplier>('suppliers').updateOne(
      { _id: supplierId },
      {
        $set: {
          verificationStatus: status,
          verificationDate: new Date(),
          verificationDetails: {
            document,
            verifiedBy,
            notes,
          },
          updatedAt: new Date(),
        },
      }
    );
  }
}

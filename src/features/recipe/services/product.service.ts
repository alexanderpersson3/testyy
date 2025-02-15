;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import { Product, ProductCategory, CreateProductDTO, UpdateProductDTO, CreateCategoryDTO, UpdateCategoryDTO } from '../types/store.js';;
import type { WithId, TransformDocument } from '../types/express.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';;

export interface ProductFilter {
  storeId?: string;
  categoryId?: string;
  inStock?: boolean;
  query?: string;
}

export interface ProductPagination {
  page: number;
  limit: number;
}

export interface ProductListResult {
  products: WithId<Product>[];
  page: number;
  totalPages: number;
  total: number;
}

export class ProductService {
  private static instance: ProductService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  async listProducts(
    filter: ProductFilter,
    pagination: ProductPagination
  ): Promise<ProductListResult> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const queryFilter: Record<string, any> = {};
    if (filter.storeId) queryFilter.storeId = new ObjectId(filter.storeId);
    if (filter.categoryId) queryFilter.categoryId = new ObjectId(filter.categoryId);
    if (filter.inStock !== undefined) queryFilter.inStock = filter.inStock;
    if (filter.query) {
      queryFilter.$or = [
        { name: { $regex: filter.query, $options: 'i' } },
        { brand: { $regex: filter.query, $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.db.getCollection<Product>('products')
        .find(queryFilter)
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.db.getCollection('products').countDocuments(queryFilter),
    ]);

    return {
      products,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    };
  }

  async getProduct(id: string): Promise<WithId<Product>> {
    const product = await this.db.getCollection<Product>('products').findOne({
      _id: new ObjectId(id),
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async createProduct(data: CreateProductDTO): Promise<WithId<Product>> {
    const doc = {
      ...data,
      storeId: new ObjectId(data.storeId),
      categoryId: new ObjectId(data.categoryId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.getCollection<Product>('products').insertOne(doc as unknown as Product);
    return {
      _id: result.insertedId,
      ...doc,
    } as WithId<Product>;
  }

  async updateProduct(id: string, data: UpdateProductDTO): Promise<WithId<Product>> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.db.getCollection<Product>('products').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Product not found');
    }

    return result as unknown as WithId<Product>;
  }

  async listCategories(storeId?: string): Promise<WithId<ProductCategory>[]> {
    const filter: Record<string, any> = {};
    if (storeId) filter.storeId = new ObjectId(storeId);

    return this.db.getCollection<ProductCategory>('product_categories')
      .find(filter)
      .sort({ order: 1 })
      .toArray();
  }

  async getCategory(id: string): Promise<WithId<ProductCategory>> {
    const category = await this.db.getCollection<ProductCategory>('product_categories').findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  async createCategory(data: CreateCategoryDTO): Promise<WithId<ProductCategory>> {
    const doc = {
      ...data,
      storeId: new ObjectId(data.storeId),
      parentId: data.parentId ? new ObjectId(data.parentId) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.getCollection<ProductCategory>('product_categories').insertOne(doc as unknown as ProductCategory);
    return {
      _id: result.insertedId,
      ...doc,
    } as WithId<ProductCategory>;
  }

  async updateCategory(id: string, data: UpdateCategoryDTO): Promise<WithId<ProductCategory>> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.db.getCollection<ProductCategory>('product_categories').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Category not found');
    }

    return result as unknown as WithId<ProductCategory>;
  }
} 
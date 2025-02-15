import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { Product, ProductCategory, CreateProductDTO, UpdateProductDTO, CreateCategoryDTO, UpdateCategoryDTO } from '../types/store.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
export class ProductService {
    constructor() {
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!ProductService.instance) {
            ProductService.instance = new ProductService();
        }
        return ProductService.instance;
    }
    async listProducts(filter, pagination) {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;
        const queryFilter = {};
        if (filter.storeId)
            queryFilter.storeId = new ObjectId(filter.storeId);
        if (filter.categoryId)
            queryFilter.categoryId = new ObjectId(filter.categoryId);
        if (filter.inStock !== undefined)
            queryFilter.inStock = filter.inStock;
        if (filter.query) {
            queryFilter.$or = [
                { name: { $regex: filter.query, $options: 'i' } },
                { brand: { $regex: filter.query, $options: 'i' } },
            ];
        }
        const [products, total] = await Promise.all([
            this.db.getCollection('products')
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
    async getProduct(id) {
        const product = await this.db.getCollection('products').findOne({
            _id: new ObjectId(id),
        });
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        return product;
    }
    async createProduct(data) {
        const doc = {
            ...data,
            storeId: new ObjectId(data.storeId),
            categoryId: new ObjectId(data.categoryId),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('products').insertOne(doc);
        return {
            _id: result.insertedId,
            ...doc,
        };
    }
    async updateProduct(id, data) {
        const updateData = {
            ...data,
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('products').findOneAndUpdate({ _id: new ObjectId(id) }, { $set: updateData }, { returnDocument: 'after' });
        if (!result) {
            throw new NotFoundError('Product not found');
        }
        return result;
    }
    async listCategories(storeId) {
        const filter = {};
        if (storeId)
            filter.storeId = new ObjectId(storeId);
        return this.db.getCollection('product_categories')
            .find(filter)
            .sort({ order: 1 })
            .toArray();
    }
    async getCategory(id) {
        const category = await this.db.getCollection('product_categories').findOne({
            _id: new ObjectId(id),
        });
        if (!category) {
            throw new NotFoundError('Category not found');
        }
        return category;
    }
    async createCategory(data) {
        const doc = {
            ...data,
            storeId: new ObjectId(data.storeId),
            parentId: data.parentId ? new ObjectId(data.parentId) : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('product_categories').insertOne(doc);
        return {
            _id: result.insertedId,
            ...doc,
        };
    }
    async updateCategory(id, data) {
        const updateData = {
            ...data,
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('product_categories').findOneAndUpdate({ _id: new ObjectId(id) }, { $set: updateData }, { returnDocument: 'after' });
        if (!result) {
            throw new NotFoundError('Category not found');
        }
        return result;
    }
}
//# sourceMappingURL=product.service.js.map
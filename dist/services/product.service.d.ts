import { Product, ProductCategory, CreateProductDTO, UpdateProductDTO, CreateCategoryDTO, UpdateCategoryDTO } from '../types/store.js';
import type { WithId } from '../types/index.js';
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
export declare class ProductService {
    private static instance;
    private db;
    private constructor();
    static getInstance(): ProductService;
    listProducts(filter: ProductFilter, pagination: ProductPagination): Promise<ProductListResult>;
    getProduct(id: string): Promise<WithId<Product>>;
    createProduct(data: CreateProductDTO): Promise<WithId<Product>>;
    updateProduct(id: string, data: UpdateProductDTO): Promise<WithId<Product>>;
    listCategories(storeId?: string): Promise<WithId<ProductCategory>[]>;
    getCategory(id: string): Promise<WithId<ProductCategory>>;
    createCategory(data: CreateCategoryDTO): Promise<WithId<ProductCategory>>;
    updateCategory(id: string, data: UpdateCategoryDTO): Promise<WithId<ProductCategory>>;
}

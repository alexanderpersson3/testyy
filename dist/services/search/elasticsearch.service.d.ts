interface SearchFilters {
    priceRange?: [number, number];
    categories?: string[];
    minRating?: number;
    sortBy?: string;
    brands?: string[];
    inStock?: boolean;
}
interface SearchHitResult<T> {
    _id: string;
    _source: T;
    _score: number;
    highlight?: Record<string, string[]>;
}
interface SearchResult<T> {
    hits: Array<SearchHitResult<T>>;
    total: number;
    aggregations?: {
        categories: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        brands: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        price_ranges: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        ratings: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        avg_price: {
            value: number;
        };
    };
    spellCorrections?: Array<{
        text: string;
        score: number;
        highlighted?: string;
    }>;
}
interface SearchAnalytics {
    totalSearches: number;
    uniqueUsers: number;
    averageSearchTime: number;
    popularQueries: Array<{
        query: string;
        count: number;
    }>;
    clickThroughRate: number;
    zeroResultQueries: Array<{
        query: string;
        count: number;
    }>;
    facetUsage: Record<string, number>;
    deviceStats: Record<string, number>;
}
interface ProductSource {
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
interface SearchOptions {
    offset?: number;
    limit?: number;
    sort?: string;
    filters?: SearchFilters;
}
export declare class ElasticsearchService {
    private static instance;
    private client;
    private monitoring;
    private constructor();
    static getInstance(): ElasticsearchService;
    private isPhraseSuggestOption;
    private handleError;
    /**
     * Search products with filters and sorting
     */
    searchProducts(query: string, filters?: SearchFilters, page?: number, limit?: number, sessionId?: string, userId?: string): Promise<SearchResult<ProductSource>>;
    private recordSearchAnalytics;
    getSearchAnalytics(period: 'day' | 'week' | 'month'): Promise<SearchAnalytics>;
    /**
     * Get search suggestions with spell correction
     */
    getSuggestions(query: string): Promise<SearchResult<ProductSource>>;
    /**
     * Index a product
     */
    indexProduct(product: Partial<ProductSource> & {
        id: string;
    }): Promise<void>;
    /**
     * Update a product
     */
    updateProduct(productId: string, updates: Partial<ProductSource>): Promise<void>;
    /**
     * Delete a product
     */
    deleteProduct(productId: string): Promise<void>;
    /**
     * Create product index with mappings
     */
    createProductIndex(): Promise<void>;
    /**
     * Check index health
     */
    checkHealth(): Promise<{
        status: string;
        documentCount: number;
        indexSize: string;
        lastUpdated?: Date;
    }>;
    private buildFilters;
    private buildSort;
    private getUserAgent;
    search<T>(query: string, options?: SearchOptions): Promise<SearchResult<T>>;
}
export {};

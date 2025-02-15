import { ElasticsearchService } from './elasticsearch.service.js';
import { DatabaseService } from '../../db/database.service.js';
import logger from '../../utils/logger.js';
import { ObjectId } from 'mongodb';
;
export class ProductIndexingService {
    constructor() {
        this.BATCH_SIZE = 100;
        this.db = DatabaseService.getInstance();
        this.searchService = ElasticsearchService.getInstance();
    }
    static getInstance() {
        if (!ProductIndexingService.instance) {
            ProductIndexingService.instance = new ProductIndexingService();
        }
        return ProductIndexingService.instance;
    }
    /**
     * Initialize Elasticsearch index and reindex all products
     */
    async initializeIndex() {
        try {
            // Create index with mappings
            await this.searchService.createProductIndex();
            // Reindex all products
            await this.reindexAll();
            logger.info('Product index initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize product index:', error);
            throw error;
        }
    }
    /**
     * Reindex all products
     */
    async reindexAll() {
        const collection = this.db.getCollection('products');
        let processed = 0;
        let batch = [];
        try {
            // Process products in batches
            const cursor = collection.find();
            while (await cursor.hasNext()) {
                const product = await cursor.next();
                if (!product)
                    continue;
                batch.push(product);
                processed++;
                if (batch.length >= this.BATCH_SIZE) {
                    await this.indexBatch(batch);
                    logger.info(`Indexed ${processed} products`);
                    batch = [];
                }
            }
            // Index remaining products
            if (batch.length > 0) {
                await this.indexBatch(batch);
                logger.info(`Indexed ${processed} products`);
            }
            logger.info('Product reindexing completed successfully');
        }
        catch (error) {
            logger.error('Failed to reindex products:', error);
            throw error;
        }
    }
    /**
     * Index a batch of products
     */
    async indexBatch(products) {
        try {
            await Promise.all(products.map(product => this.searchService.indexProduct({
                id: product._id.toString(),
                name: product.name,
                description: product.description,
                price: product.price,
                brand: product.brand,
                categories: product.categories,
                rating: product.rating,
                reviewCount: product.reviewCount,
                inStock: product.inStock,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            })));
        }
        catch (error) {
            logger.error('Failed to index batch:', error);
            throw error;
        }
    }
    /**
     * Handle product updates
     */
    async handleProductUpdate(productId, updates) {
        try {
            await this.searchService.updateProduct(productId, updates);
            logger.info(`Updated product ${productId} in search index`);
        }
        catch (error) {
            logger.error(`Failed to update product ${productId} in search index:`, error);
            throw error;
        }
    }
    /**
     * Handle product deletion
     */
    async handleProductDeletion(productId) {
        try {
            await this.searchService.deleteProduct(productId);
            logger.info(`Deleted product ${productId} from search index`);
        }
        catch (error) {
            logger.error(`Failed to delete product ${productId} from search index:`, error);
            throw error;
        }
    }
    /**
     * Sync product with search index
     */
    async syncProduct(product) {
        try {
            await this.searchService.indexProduct({
                id: product._id.toString(),
                name: product.name,
                description: product.description,
                price: product.price,
                brand: product.brand,
                categories: product.categories,
                rating: product.rating,
                reviewCount: product.reviewCount,
                inStock: product.inStock,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            });
            logger.info(`Synced product ${product._id} with search index`);
        }
        catch (error) {
            logger.error(`Failed to sync product ${product._id} with search index:`, error);
            throw error;
        }
    }
}
ProductIndexingService.instance = null;
//# sourceMappingURL=product-indexing.service.js.map
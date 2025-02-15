import { ElasticsearchService } from '../services/search/elasticsearch.service.js';
import { handleError } from '../utils/errors.js';
import { z } from 'zod';
const searchService = ElasticsearchService.getInstance();
// Validation schemas
const searchQuerySchema = z.object({
    q: z.string().min(1),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    priceRange: z.string()
        .transform(val => {
        const [min, max] = val.split(',').map(Number);
        return [min, max];
    })
        .refine(arr => arr.length === 2 && arr[0] <= arr[1])
        .optional(),
    categories: z.string().transform(val => val.split(',')).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'newest']).optional(),
});
const suggestionsQuerySchema = z.object({
    q: z.string().min(1),
});
export const searchController = {
    /**
     * Search products
     */
    async search(req, res) {
        try {
            const query = await searchQuerySchema.parseAsync(req.query);
            const filters = {
                priceRange: query.priceRange,
                categories: query.categories,
                minRating: query.minRating,
                sortBy: query.sortBy,
            };
            const results = await searchService.searchProducts(query.q, filters, query.page, query.limit);
            res.json({
                results: results.hits.map(hit => ({
                    id: hit._id,
                    ...hit._source,
                    score: hit._score,
                    highlights: hit.highlight,
                })),
                total: results.total,
                aggregations: results.aggregations,
            });
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
            }
            else {
                handleError(error instanceof Error ? error : new Error('Search failed'), res);
            }
        }
    },
    /**
     * Get search suggestions
     */
    async getSuggestions(req, res) {
        try {
            const { q } = await suggestionsQuerySchema.parseAsync(req.query);
            const results = await searchService.getSuggestions(q);
            res.json({
                suggestions: results.hits.map(hit => ({
                    id: hit._id,
                    text: hit._source.name,
                    type: hit._source.type || 'product',
                    price: hit._source.price,
                    rating: hit._source.rating,
                    highlights: hit.highlight,
                })),
            });
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Invalid query parameter', details: error.errors });
            }
            else {
                handleError(error instanceof Error ? error : new Error('Failed to get suggestions'), res);
            }
        }
    },
    /**
     * Index a product
     */
    async indexProduct(req, res) {
        try {
            await searchService.indexProduct(req.body);
            res.status(201).json({ message: 'Product indexed successfully' });
        }
        catch (error) {
            handleError(error instanceof Error ? error : new Error('Failed to index product'), res);
        }
    },
    /**
     * Update indexed product
     */
    async updateProduct(req, res) {
        try {
            await searchService.updateProduct(req.params.id, req.body);
            res.json({ message: 'Product updated successfully' });
        }
        catch (error) {
            handleError(error instanceof Error ? error : new Error('Failed to update product'), res);
        }
    },
    /**
     * Delete indexed product
     */
    async deleteProduct(req, res) {
        try {
            await searchService.deleteProduct(req.params.id);
            res.json({ message: 'Product deleted successfully' });
        }
        catch (error) {
            handleError(error instanceof Error ? error : new Error('Failed to delete product'), res);
        }
    },
    /**
     * Initialize product index
     */
    async initializeIndex(req, res) {
        try {
            await searchService.createProductIndex();
            res.json({ message: 'Product index created successfully' });
        }
        catch (error) {
            handleError(error instanceof Error ? error : new Error('Failed to create product index'), res);
        }
    },
};
//# sourceMappingURL=search.controller.js.map
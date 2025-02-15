import { Client } from '@elastic/elasticsearch';
import logger from '../../utils/logger.js';
import { MonitoringService } from '../monitoring.service.js';
class ElasticsearchError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'ElasticsearchError';
    }
}
export class ElasticsearchService {
    constructor() {
        this.client = new Client({
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
            auth: {
                username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
                password: process.env.ELASTICSEARCH_PASSWORD || '',
            },
        });
        this.monitoring = MonitoringService.getInstance();
        // Bind methods that are used as callbacks
        this.isPhraseSuggestOption = this.isPhraseSuggestOption.bind(this);
    }
    static getInstance() {
        if (!ElasticsearchService.instance) {
            ElasticsearchService.instance = new ElasticsearchService();
        }
        return ElasticsearchService.instance;
    }
    isPhraseSuggestOption(option) {
        return 'text' in option && 'score' in option && !('freq' in option);
    }
    handleError(operation, error) {
        logger.error(`${operation} failed:`, error);
        throw new ElasticsearchError(`Failed to ${operation}`, error);
    }
    /**
     * Search products with filters and sorting
     */
    async searchProducts(query, filters = {}, page = 1, limit = 20, sessionId, userId) {
        try {
            const startTime = Date.now();
            const multiMatchQuery = {
                query,
                fields: ['name^3', 'description^2', 'brand', 'categories'],
                fuzziness: 'AUTO',
                type: 'best_fields',
            };
            const matchAllQuery = { boost: 1.0 };
            const must = query
                ? [{ multi_match: multiMatchQuery }]
                : [{ match_all: matchAllQuery }];
            const response = await this.client.search({
                index: 'products',
                query: {
                    bool: {
                        must,
                        filter: this.buildFilters(filters),
                    },
                },
                from: (page - 1) * limit,
                size: limit,
                sort: this.buildSort(filters.sortBy),
                highlight: {
                    fields: {
                        name: {},
                        description: {},
                    },
                },
                aggregations: {
                    categories: {
                        terms: { field: 'categories.keyword', size: 20 },
                    },
                    brands: {
                        terms: { field: 'brand.keyword', size: 20 },
                    },
                    price_ranges: {
                        range: {
                            field: 'price',
                            ranges: [
                                { to: 50 },
                                { from: 50, to: 100 },
                                { from: 100, to: 200 },
                                { from: 200, to: 500 },
                                { from: 500 },
                            ],
                        },
                    },
                    ratings: {
                        terms: { field: 'rating', size: 5 },
                    },
                    avg_price: {
                        avg: { field: 'price' },
                    },
                },
                suggest: {
                    text: query,
                    phrase_suggest: {
                        phrase: {
                            field: 'name.trigram',
                            size: 3,
                            gram_size: 3,
                            direct_generator: [{ field: 'name.trigram', suggest_mode: 'always' }],
                            highlight: { pre_tag: '<em>', post_tag: '</em>' },
                        },
                    },
                },
            });
            const duration = Date.now() - startTime;
            const totalHits = response.hits?.total;
            const resultCount = typeof totalHits === 'number' ? totalHits : totalHits?.value ?? 0;
            await this.recordSearchAnalytics({
                query,
                filters,
                duration,
                resultCount,
                sessionId,
                userId,
            }).catch(error => {
                // Log but don't fail the search if analytics fails
                logger.error('Failed to record search analytics:', error);
            });
            const hits = (response.hits?.hits || []).map((hit) => ({
                _id: hit._id,
                _source: hit._source,
                _score: hit._score ?? 0,
                highlight: hit.highlight,
            }));
            const total = typeof response.hits?.total === 'number'
                ? response.hits.total
                : response.hits?.total?.value ?? 0;
            const aggregations = response.aggregations;
            const spellSuggestions = response.suggest?.phrase_suggest?.[0]?.options;
            const spellCorrections = Array.isArray(spellSuggestions)
                ? spellSuggestions
                    .filter(this.isPhraseSuggestOption)
                    .map(option => ({
                    text: option.text,
                    score: option.score ?? 0,
                    highlighted: option.highlighted ?? undefined,
                }))
                : [];
            return {
                hits,
                total,
                aggregations,
                spellCorrections,
            };
        }
        catch (error) {
            this.handleError('search products', error);
        }
    }
    async recordSearchAnalytics(data) {
        try {
            await this.client.index({
                index: 'search_analytics',
                body: {
                    ...data,
                    timestamp: new Date(),
                    userAgent: data.sessionId ? await this.getUserAgent(data.sessionId) : undefined,
                },
            });
            const request = {
                path: '/api/search',
                method: 'GET',
                headers: {},
                query: { q: data.query },
            };
            const response = {
                statusCode: 200,
                headers: {},
                body: { total: data.resultCount },
            };
            this.monitoring.trackHttpRequest(request, response, data.duration);
            // Record search-specific metrics
            this.monitoring.recordMetric({
                name: 'search_latency',
                value: data.duration,
                labels: {
                    has_filters: String(Object.keys(data.filters).length > 0),
                },
            });
            this.monitoring.recordMetric({
                name: 'search_results',
                value: data.resultCount,
                labels: {
                    query_length: String(data.query.length),
                },
            });
        }
        catch (error) {
            logger.error('Failed to record search analytics:', error);
        }
    }
    async getSearchAnalytics(period) {
        try {
            const response = await this.client.search({
                index: 'search_analytics',
                body: {
                    query: {
                        range: {
                            timestamp: {
                                gte: `now-1${period}`,
                            },
                        },
                    },
                    aggs: {
                        total_searches: { value_count: { field: 'query' } },
                        unique_users: { cardinality: { field: 'userId' } },
                        avg_duration: { avg: { field: 'duration' } },
                        popular_queries: {
                            terms: { field: 'query.keyword', size: 10 },
                        },
                        zero_results: {
                            filter: { term: { resultCount: 0 } },
                            aggs: {
                                queries: { terms: { field: 'query.keyword', size: 10 } },
                            },
                        },
                        facet_usage: {
                            terms: { field: 'filters.keyword' },
                        },
                        device_stats: {
                            terms: { field: 'userAgent.device.keyword' },
                        },
                    },
                },
            });
            const aggs = response.aggregations;
            if (!aggs) {
                throw new Error('No aggregations found in response');
            }
            return {
                totalSearches: aggs.total_searches.value,
                uniqueUsers: aggs.unique_users.value,
                averageSearchTime: aggs.avg_duration.value ?? 0,
                popularQueries: aggs.popular_queries.buckets.map((bucket) => ({
                    query: String(bucket.key),
                    count: bucket.doc_count,
                })),
                clickThroughRate: 0, // TODO: Implement click tracking
                zeroResultQueries: aggs.zero_results.queries.buckets.map((bucket) => ({
                    query: String(bucket.key),
                    count: bucket.doc_count,
                })),
                facetUsage: Object.fromEntries(aggs.facet_usage.buckets.map((bucket) => [String(bucket.key), bucket.doc_count])),
                deviceStats: Object.fromEntries(aggs.device_stats.buckets.map((bucket) => [String(bucket.key), bucket.doc_count])),
            };
        }
        catch (error) {
            logger.error('Failed to get search analytics:', error);
            throw error;
        }
    }
    /**
     * Get search suggestions with spell correction
     */
    async getSuggestions(query) {
        try {
            const [suggestResponse, searchResponse] = await Promise.all([
                // Get completion suggestions
                this.client.search({
                    index: 'products',
                    body: {
                        suggest: {
                            name_suggest: {
                                prefix: query,
                                completion: {
                                    field: 'name.suggest',
                                    fuzzy: {
                                        fuzziness: 'AUTO',
                                    },
                                    size: 5,
                                },
                            },
                            brand_suggest: {
                                prefix: query,
                                completion: {
                                    field: 'brand.suggest',
                                    fuzzy: {
                                        fuzziness: 'AUTO',
                                    },
                                    size: 3,
                                },
                            },
                        },
                    },
                }),
                // Get search suggestions with spell correction
                this.client.search({
                    index: 'products',
                    body: {
                        size: 5,
                        query: {
                            multi_match: {
                                query,
                                fields: ['name.fuzzy^3', 'brand^2', 'categories'],
                                type: 'best_fields',
                                fuzziness: 'AUTO',
                            },
                        },
                        suggest: {
                            text: query,
                            phrase_suggest: {
                                phrase: {
                                    field: 'name.fuzzy',
                                    size: 1,
                                    gram_size: 3,
                                    direct_generator: [{
                                            field: 'name.fuzzy',
                                            suggest_mode: 'always',
                                        }],
                                    highlight: {
                                        pre_tag: '<em>',
                                        post_tag: '</em>',
                                    },
                                },
                            },
                        },
                        highlight: {
                            fields: {
                                'name.fuzzy': {},
                                brand: {},
                            },
                        },
                    },
                }),
            ]);
            // Combine and deduplicate suggestions
            const suggestions = new Map();
            // Add completion suggestions
            const nameSuggestions = suggestResponse.suggest?.name_suggest?.[0].options || [];
            const brandSuggestions = suggestResponse.suggest?.brand_suggest?.[0].options || [];
            nameSuggestions.forEach(option => {
                if (option._source && option._id) {
                    suggestions.set(option._id, {
                        id: option._id,
                        text: option._source.name,
                        type: 'product',
                        price: option._source.price,
                        rating: option._source.rating,
                        score: option._score ?? 0,
                    });
                }
            });
            brandSuggestions.forEach(option => {
                if (option._source && option._id) {
                    suggestions.set(option._id, {
                        id: option._id,
                        text: option._source.brand,
                        type: 'brand',
                        score: option._score ?? 0,
                    });
                }
            });
            // Add search suggestions
            searchResponse.hits.hits.forEach((hit) => {
                if (hit._source && hit._id) {
                    suggestions.set(hit._id, {
                        id: hit._id,
                        text: hit._source.name,
                        type: 'product',
                        price: hit._source.price,
                        rating: hit._source.rating,
                        score: hit._score ?? 0,
                        highlights: hit.highlight,
                    });
                }
            });
            // Get spell corrections
            const spellSuggestions = searchResponse.suggest?.phrase_suggest?.[0].options || [];
            return {
                hits: Array.from(suggestions.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5)
                    .map(suggestion => ({
                    _id: suggestion.id,
                    _source: {
                        name: suggestion.text,
                        description: '',
                        price: suggestion.price ?? 0,
                        brand: suggestion.type === 'brand' ? suggestion.text : '',
                        categories: [],
                        rating: suggestion.rating ?? 0,
                        reviewCount: 0,
                        inStock: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    _score: suggestion.score,
                    highlight: suggestion.highlights,
                })),
                total: suggestions.size,
                spellCorrections: spellSuggestions.map(correction => ({
                    text: correction.text,
                    score: correction.score ?? 0,
                    highlighted: correction.highlighted,
                })),
            };
        }
        catch (error) {
            logger.error('Elasticsearch suggestions error:', error);
            throw new Error('Failed to get suggestions');
        }
    }
    /**
     * Index a product
     */
    async indexProduct(product) {
        try {
            await this.client.index({
                index: 'products',
                id: product.id,
                body: {
                    ...product,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            this.handleError('index product', error);
        }
    }
    /**
     * Update a product
     */
    async updateProduct(productId, updates) {
        try {
            await this.client.update({
                index: 'products',
                id: productId,
                body: {
                    doc: {
                        ...updates,
                        updatedAt: new Date(),
                    },
                },
            });
        }
        catch (error) {
            this.handleError('update product', error);
        }
    }
    /**
     * Delete a product
     */
    async deleteProduct(productId) {
        try {
            await this.client.delete({
                index: 'products',
                id: productId,
            });
        }
        catch (error) {
            this.handleError('delete product', error);
        }
    }
    /**
     * Create product index with mappings
     */
    async createProductIndex() {
        try {
            const indexExists = await this.client.indices.exists({
                index: 'products',
            });
            if (!indexExists) {
                await this.client.indices.create({
                    index: 'products',
                    body: {
                        settings: {
                            analysis: {
                                analyzer: {
                                    product_analyzer: {
                                        type: 'custom',
                                        tokenizer: 'standard',
                                        filter: [
                                            'lowercase',
                                            'asciifolding',
                                            'synonym',
                                            'word_delimiter',
                                            'product_stemmer',
                                        ],
                                    },
                                    search_analyzer: {
                                        type: 'custom',
                                        tokenizer: 'standard',
                                        filter: [
                                            'lowercase',
                                            'asciifolding',
                                            'synonym',
                                            'word_delimiter',
                                            'product_stemmer',
                                        ],
                                    },
                                },
                                filter: {
                                    synonym: {
                                        type: 'synonym',
                                        synonyms: [
                                            'laptop, notebook',
                                            'phone, smartphone, mobile',
                                            'tv, television',
                                            'headphone, headset',
                                            'wifi, wireless',
                                        ],
                                    },
                                    product_stemmer: {
                                        type: 'stemmer',
                                        language: 'english',
                                    },
                                },
                            },
                            'index.max_ngram_diff': 7,
                        },
                        mappings: {
                            properties: {
                                name: {
                                    type: 'text',
                                    analyzer: 'product_analyzer',
                                    search_analyzer: 'search_analyzer',
                                    fields: {
                                        keyword: { type: 'keyword' },
                                        suggest: {
                                            type: 'completion',
                                            analyzer: 'product_analyzer',
                                        },
                                        fuzzy: {
                                            type: 'text',
                                            analyzer: 'product_analyzer',
                                        },
                                    },
                                },
                                description: {
                                    type: 'text',
                                    analyzer: 'product_analyzer',
                                    search_analyzer: 'search_analyzer',
                                },
                                price: { type: 'double' },
                                brand: {
                                    type: 'text',
                                    fields: {
                                        keyword: { type: 'keyword' },
                                        suggest: {
                                            type: 'completion',
                                            analyzer: 'product_analyzer',
                                        },
                                    },
                                },
                                categories: {
                                    type: 'text',
                                    fields: {
                                        keyword: { type: 'keyword' },
                                        suggest: {
                                            type: 'completion',
                                            analyzer: 'product_analyzer',
                                        },
                                    },
                                },
                                rating: { type: 'float' },
                                reviewCount: { type: 'integer' },
                                inStock: { type: 'boolean' },
                                createdAt: { type: 'date' },
                                updatedAt: { type: 'date' },
                            },
                        },
                    },
                });
            }
        }
        catch (error) {
            this.handleError('create product index', error);
        }
    }
    /**
     * Check index health
     */
    async checkHealth() {
        try {
            const [health, stats] = await Promise.all([
                this.client.cluster.health({ index: 'products' }),
                this.client.indices.stats({ index: 'products' }),
            ]);
            const indexStats = stats.indices?.products?.total;
            if (!indexStats) {
                throw new Error('Failed to get index statistics');
            }
            const formatByteSize = (size) => {
                if (!size)
                    return '0b';
                if (typeof size === 'string')
                    return size;
                const units = ['b', 'kb', 'mb', 'gb', 'tb'];
                let value = size;
                let unitIndex = 0;
                while (value >= 1024 && unitIndex < units.length - 1) {
                    value /= 1024;
                    unitIndex++;
                }
                return `${Math.round(value * 100) / 100}${units[unitIndex]}`;
            };
            return {
                status: health.status,
                documentCount: indexStats.docs?.count || 0,
                indexSize: formatByteSize(indexStats.store?.size),
                lastUpdated: indexStats.indexing?.index_time_in_millis
                    ? new Date(indexStats.indexing.index_time_in_millis)
                    : undefined,
            };
        }
        catch (error) {
            this.handleError('check index health', error);
        }
    }
    buildFilters(filters = {}) {
        const filterClauses = [];
        if (filters.priceRange) {
            filterClauses.push({
                range: {
                    price: {
                        gte: filters.priceRange[0],
                        lte: filters.priceRange[1],
                    },
                },
            });
        }
        if (filters.categories?.length) {
            filterClauses.push({
                terms: {
                    categories: filters.categories,
                },
            });
        }
        if (filters.minRating) {
            filterClauses.push({
                range: {
                    rating: {
                        gte: filters.minRating,
                    },
                },
            });
        }
        if (filters.brands?.length) {
            filterClauses.push({
                terms: {
                    brand: filters.brands,
                },
            });
        }
        if (typeof filters.inStock === 'boolean') {
            filterClauses.push({
                term: {
                    inStock: filters.inStock,
                },
            });
        }
        return filterClauses;
    }
    buildSort(sortBy) {
        switch (sortBy) {
            case 'price_asc':
                return [{ price: 'asc' }];
            case 'price_desc':
                return [{ price: 'desc' }];
            case 'rating':
                return [{ rating: 'desc' }];
            case 'newest':
                return [{ createdAt: 'desc' }];
            default:
                return [{ _score: 'desc' }];
        }
    }
    async getUserAgent(sessionId) {
        try {
            // Implement user agent lookup from session storage
            return undefined;
        }
        catch (error) {
            logger.error('Failed to get user agent:', error);
            return undefined;
        }
    }
    async search(query, options = {}) {
        try {
            const multiMatchQuery = {
                query,
                fields: ['name^2', 'description', 'categories^1.5', 'brand'],
                fuzziness: 'AUTO',
                type: 'best_fields',
            };
            const matchAllQuery = { boost: 1.0 };
            const must = query
                ? [{ multi_match: multiMatchQuery }]
                : [{ match_all: matchAllQuery }];
            const response = await this.client.search({
                index: 'products',
                query: {
                    bool: {
                        must,
                        filter: this.buildFilters(options.filters),
                    },
                },
                from: options.offset || 0,
                size: options.limit || 10,
                sort: this.buildSort(options.sort),
                highlight: {
                    fields: {
                        name: {},
                        description: {},
                    },
                },
                aggregations: {
                    categories: {
                        terms: { field: 'categories.keyword' },
                    },
                    brands: {
                        terms: { field: 'brand.keyword' },
                    },
                    price_ranges: {
                        range: {
                            field: 'price',
                            ranges: [
                                { to: 10 },
                                { from: 10, to: 50 },
                                { from: 50, to: 100 },
                                { from: 100 },
                            ],
                        },
                    },
                    ratings: {
                        terms: { field: 'rating' },
                    },
                    avg_price: {
                        avg: { field: 'price' },
                    },
                },
            });
            const hits = (response.hits?.hits || []).map(hit => ({
                _id: hit._id,
                _source: hit._source,
                _score: hit._score ?? 0,
                highlight: hit.highlight,
            }));
            const total = typeof response.hits?.total === 'number' ?
                response.hits.total :
                response.hits?.total?.value ?? 0;
            return {
                hits,
                total,
                aggregations: response.aggregations,
                spellCorrections: [],
            };
        }
        catch (error) {
            this.handleError('search', error);
        }
    }
}
ElasticsearchService.instance = null;
//# sourceMappingURL=elasticsearch.service.js.map
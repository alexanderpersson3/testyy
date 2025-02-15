import { Client } from '@elastic/elasticsearch';
import { SearchQuery as BaseSearchQuery, SearchResult, SearchResults } from '../types/search.js';
import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
export class SearchService {
    constructor() {
        this.DEFAULT_PAGE_SIZE = 20;
        this.MAX_PAGE_SIZE = 100;
        this.db = DatabaseService.getInstance();
        this.client = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
    }
    static getInstance() {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }
    async searchRecipes(options) {
        const { query, sortBy = 'createdAt', order = 'desc', categories, tags, difficulty, cuisine, maxPrepTime, isPrivate, isPro, userId, page = 1, limit = 20, } = options;
        // Build query
        const filter = {};
        // Text search
        if (query) {
            filter.$text = { $search: query };
        }
        // Category filter
        if (categories?.length) {
            filter.categories = { $in: categories };
        }
        // Tags filter
        if (tags?.length) {
            filter.tags = { $in: tags };
        }
        // Difficulty filter
        if (difficulty) {
            filter.difficulty = difficulty;
        }
        // Cuisine filter
        if (cuisine) {
            filter.cuisine = cuisine;
        }
        // Prep time filter
        if (maxPrepTime) {
            filter.prepTime = { $lte: maxPrepTime };
        }
        // Privacy filter
        if (typeof isPrivate === 'boolean') {
            filter.isPrivate = isPrivate;
        }
        // Pro filter
        if (typeof isPro === 'boolean') {
            filter.isPro = isPro;
        }
        // User filter
        if (userId) {
            filter.userId = userId;
        }
        // Build sort
        const sort = {};
        if (sortBy === 'relevance' && query) {
            sort.score = { $meta: 'textScore' };
        }
        else {
            sort[sortBy] = order === 'asc' ? 1 : -1;
        }
        // Execute query
        const skip = (page - 1) * limit;
        const [recipes, total] = await Promise.all([
            this.db.getCollection('recipes').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
            this.db.getCollection('recipes').countDocuments(filter),
        ]);
        return { recipes: recipes, total };
    }
    async getSuggestions(query) {
        if (!query || query.length < 2) {
            return [];
        }
        const suggestions = [];
        const recipesCollection = this.db.getCollection('recipes');
        // Recipe name suggestions
        const recipeMatches = await recipesCollection
            .aggregate([
            {
                $match: {
                    title: { $regex: query, $options: 'i' },
                    isPrivate: false,
                },
            },
            {
                $group: {
                    _id: null,
                    matches: { $addToSet: '$title' },
                    count: { $sum: 1 },
                },
            },
        ])
            .toArray();
        if (recipeMatches.length > 0) {
            const matches = recipeMatches[0].matches;
            matches.slice(0, 5).forEach(text => {
                suggestions.push({
                    type: 'recipe',
                    text,
                    count: recipeMatches[0].count,
                });
            });
        }
        // Ingredient suggestions
        const ingredientMatches = await recipesCollection
            .aggregate([
            {
                $match: {
                    'ingredients.name': { $regex: query, $options: 'i' },
                    isPrivate: false,
                },
            },
            {
                $unwind: '$ingredients',
            },
            {
                $match: {
                    'ingredients.name': { $regex: query, $options: 'i' },
                },
            },
            {
                $group: {
                    _id: '$ingredients.name',
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 5,
            },
        ])
            .toArray();
        ingredientMatches.forEach(match => {
            suggestions.push({
                type: 'ingredient',
                text: match._id,
                count: match.count,
            });
        });
        // Category suggestions
        const categoryMatches = await recipesCollection
            .aggregate([
            {
                $match: {
                    categories: { $regex: query, $options: 'i' },
                    isPrivate: false,
                },
            },
            {
                $unwind: '$categories',
            },
            {
                $match: {
                    categories: { $regex: query, $options: 'i' },
                },
            },
            {
                $group: {
                    _id: '$categories',
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 3,
            },
        ])
            .toArray();
        categoryMatches.forEach(match => {
            suggestions.push({
                type: 'category',
                text: match._id,
                count: match.count,
            });
        });
        // Tag suggestions
        const tagMatches = await recipesCollection
            .aggregate([
            {
                $match: {
                    tags: { $regex: query, $options: 'i' },
                    isPrivate: false,
                },
            },
            {
                $unwind: '$tags',
            },
            {
                $match: {
                    tags: { $regex: query, $options: 'i' },
                },
            },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 3,
            },
        ])
            .toArray();
        tagMatches.forEach(match => {
            suggestions.push({
                type: 'tag',
                text: match._id,
                count: match.count,
            });
        });
        return suggestions;
    }
    async getPopularSearches() {
        // In a real application, you would track and store popular searches
        // This is a mock implementation
        return [
            { text: 'chicken', count: 1500 },
            { text: 'pasta', count: 1200 },
            { text: 'vegetarian', count: 1000 },
            { text: 'quick dinner', count: 800 },
            { text: 'dessert', count: 700 },
        ];
    }
    async search(query) {
        const { searchTerm, filters, sort, page = 1, limit = 10 } = query;
        const esQuery = {
            index: 'recipes',
            body: {
                query: {
                    bool: {
                        must: [
                            {
                                multi_match: {
                                    query: searchTerm,
                                    fields: ['title^2', 'description', 'ingredients.name'],
                                },
                            },
                        ],
                        filter: this.buildFilters(filters),
                    },
                },
                sort: this.buildSort(sort),
                from: (page - 1) * limit,
                size: limit,
                highlight: {
                    fields: {
                        title: {},
                        description: {},
                        'ingredients.name': {},
                    },
                },
                aggs: this.buildAggregations(),
            },
        };
        const response = await this.client.search(esQuery);
        const hits = response.hits.hits.map(hit => ({
            _id: new ObjectId(hit._id),
            title: hit._source.title,
            description: hit._source.description,
            score: hit._score || 0,
            highlights: hit.highlight || {},
        }));
        const total = typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value || 0;
        return {
            results: hits,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    buildFilters(filters) {
        // Implementation of filter building
        return [];
    }
    buildSort(sort) {
        if (!sort)
            return [{ _score: 'desc' }];
        return [{ [sort.field]: sort.direction }];
    }
    buildAggregations() {
        return {
            categories: {
                terms: { field: 'categories.keyword' },
            },
            difficulty: {
                terms: { field: 'difficulty.keyword' },
            },
            cuisine: {
                terms: { field: 'cuisine.keyword' },
            },
        };
    }
    processMatch(match) {
        return {
            _id: new ObjectId(),
            title: match.field,
            description: match.value,
            score: match.score,
            highlights: {
                [match.field]: [match.value],
            },
        };
    }
}
//# sourceMappingURL=search.js.map
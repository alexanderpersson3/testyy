;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { DatabaseService } from '../db/database.service.js';;
import logger from '../utils/logger.js';
import { SearchAnalyticsService } from './search-analytics.service.js';;
import { SearchPerformanceService } from './search-performance.service.js';;
import { DatabaseError, ValidationError } from '../utils/errors.js';;
import type { SortOption, SearchFilters as SearchFiltersType } from '../types/express.js';
import { SearchQuery, SearchResult, SearchResults, SearchFacets, SearchEvent, SearchPerformanceMetrics,  } from '../types/search.js';;
import type { Recipe } from '../types/express.js';
import { Client } from '@elastic/elasticsearch';;

interface SearchQueryBuilder {
  $text?: { $search: string };
  category?: { $in: string[] };
  cuisine?: { $in: string[] };
  difficulty?: { $in: string[] };
  'ingredients.name'?: { $all: string[] };
  totalTime?: {
    $gte?: number;
    $lte?: number;
  };
}

type AggregationStage =
  | { $match: SearchQueryBuilder }
  | { $sort: Record<string, 1 | -1 | { $meta: string }> }
  | { $skip: number }
  | { $limit: number };

export interface SearchServiceInterface {
  search(query: SearchQuery, userId?: string, sessionId?: string): Promise<SearchResults>;
  getSearchFacets(query: SearchQuery): Promise<SearchFacets>;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recipe' | 'ingredient' | 'tag';
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  hits: Recipe[];
  total: number;
  page: number;
  totalPages: number;
  aggregations?: {
    cuisines: { buckets: Array<{ key: string; doc_count: number }> };
    difficulties: { buckets: Array<{ key: string; doc_count: number }> };
    cookingTimes: { buckets: Array<{ key: string; doc_count: number }> };
    ratings: { buckets: Array<{ key: number; doc_count: number }> };
  };
}

export interface SearchFilters {
  cuisine?: string[];
  difficulty?: string[];
  cookingTime?: {
    min?: number;
    max?: number;
  };
  dietary?: string[];
  ingredients?: string[];
  excludeIngredients?: string[];
  rating?: number;
  sort?: 'trending_daily' | 'trending_weekly' | 'trending_monthly';
}

import { SearchHit } from '@elastic/elasticsearch/lib/api/types';;

interface ElasticsearchSource extends SearchHit<{
  title?: string;
  name?: string;
}> {}

export class SearchService implements SearchServiceInterface {
  private static instance: SearchService;
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly MAX_PAGE_SIZE = 100;
  private initialized: boolean = false;
  private db: DatabaseService;
  private recipesCollection!: Collection<Recipe>;
  private analyticsService: SearchAnalyticsService;
  private performanceService: SearchPerformanceService;
  private client: Client;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.analyticsService = SearchAnalyticsService.getInstance();
    this.performanceService = SearchPerformanceService.getInstance();
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
    this.initialize().catch(error => {
      logger.error('Failed to initialize SearchService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.recipesCollection = this.db.getCollection<Recipe>('recipes');
      this.initialized = true;
      logger.info('SearchService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SearchService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  private validateSearchQuery(query: SearchQuery): void {
    if (query.page !== undefined && (query.page < 1 || !Number.isInteger(query.page))) {
      throw new ValidationError('Page must be a positive integer');
    }
    if (query.limit !== undefined && (query.limit < 1 || !Number.isInteger(query.limit))) {
      throw new ValidationError('Limit must be a positive integer');
    }
    if (query.text !== undefined && typeof query.text !== 'string') {
      throw new ValidationError('Search text must be a string');
    }
    if (query.filters) {
      if (query.filters.time?.min !== undefined && query.filters.time.min < 0) {
        throw new ValidationError('Minimum time cannot be negative');
      }
      if (query.filters.time?.max !== undefined && query.filters.time.max < 0) {
        throw new ValidationError('Maximum time cannot be negative');
      }
      if (
        query.filters.time?.min !== undefined &&
        query.filters.time?.max !== undefined &&
        query.filters.time.min > query.filters.time.max
      ) {
        throw new ValidationError('Minimum time cannot be greater than maximum time');
      }
    }
  }

  public async search(
    query: SearchQuery,
    userId?: string,
    sessionId?: string
  ): Promise<SearchResults> {
    const startTime = Date.now();
    let successful = true;
    let error: string | undefined;
    let resultCount = 0;

    try {
      await this.ensureInitialized();
      this.validateSearchQuery(query);

      // Build search query
      const searchQuery = this.buildSearchQuery(query);

      // Get pagination parameters
      const page = query.page || 1;
      const limit = Math.min(query.limit || this.DEFAULT_PAGE_SIZE, this.MAX_PAGE_SIZE);

      // Execute search
      const pipeline: AggregationStage[] = [
        { $match: searchQuery },
        { $sort: this.buildSortQuery(query.sort) },
      ];

      if (page > 1) {
        pipeline.push({ $skip: (page - 1) * limit });
      }
      pipeline.push({ $limit: limit });

      const results = await this.recipesCollection.aggregate<Recipe>(pipeline).toArray();

      resultCount = results.length;

      // Get total count
      const total = await this.recipesCollection.countDocuments(searchQuery);

      // Process results
      const processedResults = await this.processResults(results, query);

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Log performance
      if (userId) {
        const performanceMetrics: Omit<SearchPerformanceMetrics, '_id'> = {
          query: query.text || '',
          filters: query.filters,
          responseTime: executionTime,
          timestamp: new Date(),
          userId: new ObjectId(userId),
          successful: true,
          resultCount,
          cacheHit: false,
        };

        await this.performanceService
          .logQueryPerformance(performanceMetrics)
          .catch(err => logger.error('Failed to log performance metrics:', err));
      }

      return {
        results: processedResults,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err) {
      successful = false;
      error = err instanceof Error ? err.message : 'Unknown error';

      if (err instanceof ValidationError) {
        throw err;
      }
      throw new DatabaseError('Search failed: ' + error);
    } finally {
      // Log analytics
      if (userId) {
        const searchEvent: Omit<SearchEvent, '_id' | 'timestamp'> = {
          userId: new ObjectId(userId),
          query: query.text || '',
          filters: query.filters,
          resultCount,
          executionTimeMs: Date.now() - startTime,
          sessionId: sessionId || 'anonymous',
          successful,
        };

        await this.analyticsService
          .logSearchEvent(searchEvent)
          .catch(err => logger.error('Failed to log search analytics:', err));
      }
    }
  }

  private buildSearchQuery(query: SearchQuery): SearchQueryBuilder {
    const searchQuery: SearchQueryBuilder = {};

    // Text search
    if (query.text) {
      searchQuery.$text = { $search: query.text };
    }

    // Apply filters
    if (query.filters) {
      const filters = query.filters;

      if (filters.category?.length) {
        searchQuery.category = { $in: filters.category };
      }
      if (filters.cuisine?.length) {
        searchQuery.cuisine = { $in: filters.cuisine };
      }
      if (filters.difficulty?.length) {
        searchQuery.difficulty = { $in: filters.difficulty };
      }
      if (filters.ingredients?.length) {
        searchQuery['ingredients.name'] = { $all: filters.ingredients };
      }
      if (filters.time) {
        const timeQuery: Record<string, number> = {};
        if (filters.time.min !== undefined) {
          timeQuery.$gte = filters.time.min;
        }
        if (filters.time.max !== undefined) {
          timeQuery.$lte = filters.time.max;
        }
        if (Object.keys(timeQuery).length > 0) {
          searchQuery.totalTime = timeQuery;
        }
      }
    }

    return searchQuery;
  }

  private buildSortQuery(sort?: SortOption): Record<string, 1 | -1 | { $meta: string }> {
    if (!sort) {
      return { score: { $meta: 'textScore' } };
    }

    const direction = sort.direction === 'asc' ? 1 : -1;
    return { [sort.field]: direction };
  }

  private async processResults(results: Recipe[], query: SearchQuery): Promise<SearchResult[]> {
    return results.map(result => {
      if (!result._id) {
        throw new Error('Recipe missing _id');
      }

      const searchResult: SearchResult = {
        _id: result._id,
        title: result.title,
        description: result.description,
        score: query.text ? (result as SearchResult).score : undefined,
        highlights: query.text ? this.generateHighlights(result, query.text) : undefined,
      };

      return searchResult;
    });
  }

  /**
   * Generate highlights for text matches
   */
  private generateHighlights(result: Recipe, searchText: string): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = {};
    const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);

    // Check title
    if (terms.some(term => result.title.toLowerCase().includes(term))) {
      highlights.title = [result.title];
    }

    // Check description
    if (terms.some(term => result.description.toLowerCase().includes(term))) {
      highlights.description = [result.description];
    }

    // Check ingredients
    const matchedIngredients = result.ingredients
      .filter(ing => terms.some(term => ing.name.toLowerCase().includes(term)))
      .map(ing => ing.name);
    if (matchedIngredients.length) {
      highlights.ingredients = matchedIngredients;
    }

    // Check instructions
    const matchedInstructions = result.instructions
      .filter(inst => terms.some(term => inst.text.toLowerCase().includes(term)))
      .map(inst => inst.text);
    if (matchedInstructions.length) {
      highlights.instructions = matchedInstructions;
    }

    return highlights;
  }

  /**
   * Get search facets
   */
  public async getSearchFacets(query: SearchQuery): Promise<SearchFacets> {
    try {
      await this.ensureInitialized();
      this.validateSearchQuery(query);

      const baseQuery = this.buildSearchQuery(query);
      const facets = await this.recipesCollection
        .aggregate<{
          cuisineTypes: Array<{ _id: string; count: number }>;
          mealTypes: Array<{ _id: string; count: number }>;
          dietaryRestrictions: Array<{ _id: string; count: number }>;
          difficulty: Array<{ _id: string; count: number }>;
          tags: Array<{ _id: string; count: number }>;
        }>([
          { $match: baseQuery },
          {
            $facet: {
              cuisineTypes: [
                { $group: { _id: '$cuisine', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
              ],
              mealTypes: [
                { $group: { _id: '$mealType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
              ],
              dietaryRestrictions: [
                { $unwind: '$dietaryRestrictions' },
                { $group: { _id: '$dietaryRestrictions', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
              ],
              difficulty: [
                { $group: { _id: '$difficulty', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
              ],
              tags: [
                { $unwind: '$tags' },
                { $group: { _id: '$tags', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 30 },
              ],
            },
          },
        ])
        .toArray();

      const [result] = facets;
      if (!result) {
        throw new Error('Failed to get facets');
      }

      return {
        cuisineTypes: this.transformFacetResults(result.cuisineTypes),
        mealTypes: this.transformFacetResults(result.mealTypes),
        dietaryRestrictions: this.transformFacetResults(result.dietaryRestrictions),
        difficulty: this.transformFacetResults(result.difficulty),
        tags: this.transformFacetResults(result.tags),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Failed to get search facets:', error);
      throw new DatabaseError('Failed to get search facets');
    }
  }

  /**
   * Transform facet results
   */
  private transformFacetResults(
    facets: Array<{ _id: string; count: number }>
  ): Array<{ value: string; count: number }> {
    return facets
      .filter(f => f._id && typeof f._id === 'string') // Filter out null/invalid values
      .map(f => ({
        value: f._id,
        count: f.count,
      }));
  }

  async searchElastic(
    query: string,
    filters?: SearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResponse> {
    const searchQuery = {
      index: 'recipes',
      body: {
        from: (page - 1) * limit,
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['title^3', 'description^2', 'ingredients.name', 'tags'],
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: this.buildFilters(filters),
          },
        },
        sort: [
          { _score: 'desc' },
          { 'ratings.average': 'desc' },
          { createdAt: 'desc' },
        ],
        aggs: {
          cuisines: {
            terms: { field: 'cuisine.keyword' },
          },
          difficulties: {
            terms: { field: 'difficulty.keyword' },
          },
          cookingTimes: {
            range: {
              field: 'totalTime',
              ranges: [
                { to: 30 },
                { from: 30, to: 60 },
                { from: 60, to: 120 },
                { from: 120 },
              ],
            },
          },
          ratings: {
            terms: { field: 'ratings.average' },
          },
        },
      },
    };

    const response = await this.client.search(searchQuery);
    return this.transformResponse(response);
  }

    async getSuggestions(query: string): Promise<{ suggestions: SearchSuggestion[] }> {
    const response = await this.client.search({
      index: ['recipes', 'ingredients'],
      body: {
        size: 5,
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'ingredients.name^2', 'tags'],
            type: 'phrase_prefix',
          },
        },
        highlight: {
          fields: {
            title: {},
            'ingredients.name': {},
            tags: {},
          },
        },
      },
    });

    return {
      suggestions: response.hits.hits.map((hit: any) => {
        const typedHit = hit as SearchHit<{title?: string; name?: string;}>;
        return {
          id: typedHit._id,
          text: typedHit._source?.title || typedHit._source?.name || '',
          type: typedHit._index === 'recipes' ? 'recipe' : 'ingredient',
          highlights: typedHit.highlight,
        };
      }),
    };
  }

  private buildFilters(filters?: SearchFilters): any[] {
    const filterClauses = [];

    if (filters?.cuisine?.length) {
      filterClauses.push({ terms: { 'cuisine.keyword': filters.cuisine } });
    }

    if (filters?.difficulty?.length) {
      filterClauses.push({ terms: { 'difficulty.keyword': filters.difficulty } });
    }

    if (filters?.cookingTime) {
      const timeFilter: any = { range: { totalTime: {} } };
      if (filters.cookingTime.min !== undefined) {
        timeFilter.range.totalTime.gte = filters.cookingTime.min;
      }
      if (filters.cookingTime.max !== undefined) {
        timeFilter.range.totalTime.lte = filters.cookingTime.max;
      }
      filterClauses.push(timeFilter);
    }

    if (filters?.dietary?.length) {
      filterClauses.push({
        terms: { 'dietary.keyword': filters.dietary },
      });
    }

    if (filters?.ingredients?.length) {
      filterClauses.push({
        terms: { 'ingredients.name.keyword': filters.ingredients },
      });
    }

    if (filters?.excludeIngredients?.length) {
      filterClauses.push({
        bool: {
          must_not: {
            terms: { 'ingredients.name.keyword': filters.excludeIngredients },
          },
        },
      });
    }

    if (filters?.rating !== undefined) {
      filterClauses.push({
        range: { 'ratings.average': { gte: filters.rating } },
      });
    }

    return filterClauses;
  }

  private transformResponse(response: any): SearchResponse {
    return {
      hits: response.hits.hits.map((hit: any) => ({
        ...hit._source,
        id: hit._id,
        score: hit._score,
      })),
      total: response.hits.total.value,
      page: Math.floor(response.hits.hits[0]?._source?.from / response.hits.hits.length) + 1,
      totalPages: Math.ceil(response.hits.total.value / response.hits.hits.length),
      aggregations: response.aggregations,
    };
  }
}

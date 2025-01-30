import { Collection, ObjectId, Sort } from 'mongodb';
import { Recipe, RecipeDocument } from '../types/recipe.js';

export interface SearchOptions {
  query?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  categories?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  maxPrepTime?: number;
  isPrivate?: boolean;
  isPro?: boolean;
  userId?: ObjectId;
  page?: number;
  limit?: number;
}

export interface SearchSuggestion {
  type: 'recipe' | 'ingredient' | 'category' | 'tag';
  text: string;
  count: number;
}

export class SearchService {
  constructor(private recipesCollection: Collection<Recipe>) {}

  async searchRecipes(options: SearchOptions): Promise<{ recipes: RecipeDocument[]; total: number }> {
    const {
      query,
      sortBy = 'createdAt',
      order = 'desc',
      categories,
      tags,
      difficulty,
      cuisine,
      maxPrepTime,
      isPrivate,
      isPro,
      userId,
      page = 1,
      limit = 20
    } = options;

    // Build query
    const filter: any = {};

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
    const sort: Sort = {};
    if (sortBy === 'relevance' && query) {
      sort.score = { $meta: 'textScore' };
    } else {
      sort[sortBy] = order === 'asc' ? 1 : -1;
    }

    // Execute query
    const skip = (page - 1) * limit;
    const [recipes, total] = await Promise.all([
      this.recipesCollection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.recipesCollection.countDocuments(filter)
    ]);

    return { recipes: recipes as RecipeDocument[], total };
  }

  async getSuggestions(query: string): Promise<SearchSuggestion[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const suggestions: SearchSuggestion[] = [];

    // Recipe name suggestions
    const recipeMatches = await this.recipesCollection
      .aggregate([
        {
          $match: {
            name: { $regex: query, $options: 'i' },
            isPrivate: false
          }
        },
        {
          $group: {
            _id: null,
            matches: { $addToSet: '$name' },
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    if (recipeMatches.length > 0) {
      recipeMatches[0].matches.slice(0, 5).forEach((text: string) => {
        suggestions.push({
          type: 'recipe',
          text,
          count: recipeMatches[0].count
        });
      });
    }

    // Ingredient suggestions
    const ingredientMatches = await this.recipesCollection
      .aggregate([
        {
          $match: {
            'ingredients.name': { $regex: query, $options: 'i' },
            isPrivate: false
          }
        },
        {
          $unwind: '$ingredients'
        },
        {
          $match: {
            'ingredients.name': { $regex: query, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$ingredients.name',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        }
      ])
      .toArray();

    ingredientMatches.forEach((match) => {
      suggestions.push({
        type: 'ingredient',
        text: match._id,
        count: match.count
      });
    });

    // Category suggestions
    const categoryMatches = await this.recipesCollection
      .aggregate([
        {
          $match: {
            categories: { $regex: query, $options: 'i' },
            isPrivate: false
          }
        },
        {
          $unwind: '$categories'
        },
        {
          $match: {
            categories: { $regex: query, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$categories',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 3
        }
      ])
      .toArray();

    categoryMatches.forEach((match) => {
      suggestions.push({
        type: 'category',
        text: match._id,
        count: match.count
      });
    });

    // Tag suggestions
    const tagMatches = await this.recipesCollection
      .aggregate([
        {
          $match: {
            tags: { $regex: query, $options: 'i' },
            isPrivate: false
          }
        },
        {
          $unwind: '$tags'
        },
        {
          $match: {
            tags: { $regex: query, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 3
        }
      ])
      .toArray();

    tagMatches.forEach((match) => {
      suggestions.push({
        type: 'tag',
        text: match._id,
        count: match.count
      });
    });

    return suggestions;
  }

  async getPopularSearches(): Promise<{ text: string; count: number }[]> {
    // In a real application, you would track and store popular searches
    // This is a mock implementation
    return [
      { text: 'chicken', count: 1500 },
      { text: 'pasta', count: 1200 },
      { text: 'vegetarian', count: 1000 },
      { text: 'quick dinner', count: 800 },
      { text: 'dessert', count: 700 }
    ];
  }
} 
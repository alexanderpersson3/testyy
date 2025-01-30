import { ObjectId, WithId, OptionalId } from 'mongodb';
import { connectToDatabase } from '../db/db.js';
import {
  Ingredient,
  CreateIngredientDTO,
  UpdateIngredientDTO,
  SearchIngredientsQuery,
  ScrapedIngredient,
  Store,
  CustomPrice
} from '../types/ingredient.js';
import { ImageService } from './image-service';
import CurrencyService from './currency-service';

export interface SearchResponse {
  ingredients: Ingredient[];
  total: number;
  createNew?: {
    suggestion: string;
    query: string;
  };
}

export interface AutoCompleteResponse {
  suggestions: {
    id: string;
    name: string;
    source: string;
    description?: string;
    isPublic: boolean;
  }[];
}

export interface IngredientWithPrices extends Ingredient {
  prices: {
    store: Store;
    price: number;
    currency: string;
    quantity: number;
    unit: string;
    convertedPrice?: {
      amount: number;
      currency: string;
    };
  }[];
}

interface AggregatedPrice extends Omit<ScrapedIngredient, 'store'> {
  store: Store;
}

export class IngredientService {
  private imageService: ImageService;
  private currencyService: CurrencyService;

  constructor() {
    this.imageService = new ImageService();
    this.currencyService = new CurrencyService();
  }

  /**
   * Get auto-complete suggestions
   */
  async getAutoCompleteSuggestions(
    query: string,
    userId?: string,
    limit: number = 10
  ): Promise<AutoCompleteResponse> {
    const db = await connectToDatabase();

    // Create case-insensitive prefix regex
    const prefixRegex = new RegExp(`^${query}`, 'i');

    // Build filter
    const filter: any = {
      name: prefixRegex
    };

    // Handle private ingredients
    if (userId) {
      filter.$or = [
        { isPublic: true },
        { createdBy: new ObjectId(userId) }
      ];
    } else {
      filter.isPublic = true;
    }

    // Get suggestions with source priority (matspar first, then user)
    const suggestions = await db.collection<Ingredient>('ingredients')
      .find(filter)
      .sort({ 
        source: 1, // matspar comes before user alphabetically
        name: 1 
      })
      .limit(limit)
      .project({
        _id: 1,
        name: 1,
        source: 1,
        description: 1,
        isPublic: 1
      })
      .toArray();

    return {
      suggestions: suggestions.map(s => ({
        id: s._id!.toString(),
        name: s.name,
        source: s.source,
        description: s.description,
        isPublic: s.isPublic ?? true
      }))
    };
  }

  /**
   * Get ingredient with prices
   */
  async getIngredientWithPrices(
    ingredientId: string,
    targetCurrency?: string
  ): Promise<IngredientWithPrices> {
    const db = await connectToDatabase();

    const ingredient = await db.collection<Ingredient>('ingredients').findOne({
      _id: new ObjectId(ingredientId)
    });

    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    // Get current prices
    const prices = await db.collection<ScrapedIngredient>('scraped_ingredients')
      .aggregate<AggregatedPrice>([
        {
          $match: {
            ingredientId: new ObjectId(ingredientId),
            validTo: { $exists: false }
          }
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store'
          }
        },
        {
          $unwind: '$store'
        }
      ])
      .toArray();

    // Convert prices if target currency specified
    const pricesWithConversion = await Promise.all(
      prices.map(async (price) => {
        let convertedPrice: { amount: number; currency: string } | undefined;

        if (targetCurrency && price.currency !== targetCurrency) {
          const converted = await this.currencyService.convert(
            price.price,
            price.currency,
            targetCurrency
          );
          convertedPrice = {
            amount: converted,
            currency: targetCurrency
          };
        }

        return {
          store: price.store,
          price: price.price,
          currency: price.currency,
          quantity: price.quantity,
          unit: price.unit,
          convertedPrice
        };
      })
    );

    return {
      ...ingredient,
      prices: pricesWithConversion
    };
  }

  /**
   * Get upload URL for ingredient image
   */
  async uploadImage(
    file: Express.Multer.File
  ): Promise<string> {
    return await this.imageService.uploadImage(file);
  }

  /**
   * Create a new user ingredient
   */
  async createUserIngredient(userId: string, data: CreateIngredientDTO): Promise<ObjectId> {
    const db = await connectToDatabase();

    // If imageUrl is provided, validate it's from our storage bucket
    if (data.imageUrl) {
      const bucketDomain = process.env.GCP_STORAGE_BUCKET;
      if (!data.imageUrl.includes(bucketDomain!)) {
        throw new Error('Invalid image URL. Must be uploaded through our service.');
      }
    }

    const customPrice: CustomPrice | undefined = data.customPrice ? {
      ...data.customPrice,
      updatedAt: new Date()
    } : undefined;

    const newIngredient: Ingredient = {
      name: data.name,
      source: 'user' as const,
      sourceCountry: 'SE', // Default to Sweden for user ingredients
      isPublic: data.isPublic ?? false,
      image: data.imageUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<Ingredient>('ingredients').insertOne(newIngredient);

    // If there's a custom price, add it as a scraped ingredient
    if (customPrice) {
      const store = {
        name: 'Custom Price',
        country: 'SE',
        source: 'user' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const scrapedIngredient: ScrapedIngredient = {
        ingredientId: result.insertedId,
        storeId: new ObjectId(),
        price: customPrice.amount,
        currency: customPrice.currency,
        quantity: customPrice.quantity,
        unit: customPrice.unit,
        store: {
          name: store.name
        },
        validFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection<ScrapedIngredient>('scraped_ingredients').insertOne(scrapedIngredient);
    }

    return result.insertedId;
  }

  /**
   * Update an ingredient
   */
  async updateIngredient(ingredientId: string, userId: string, data: UpdateIngredientDTO): Promise<void> {
    const db = await connectToDatabase();

    const ingredient = await db.collection<Ingredient>('ingredients').findOne({
      _id: new ObjectId(ingredientId)
    });

    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    // Only creator can update user ingredients
    if (ingredient.source === 'user' && ingredient._id.toString() !== userId) {
      throw new Error('Not authorized to update this ingredient');
    }

    const update: Partial<Ingredient> = {
      ...(data.name && { name: data.name }),
      ...(data.imageUrl && { image: data.imageUrl }),
      ...(typeof data.isPublic === 'boolean' && { isPublic: data.isPublic }),
      updatedAt: new Date()
    };

    await db.collection('ingredients').updateOne(
      { _id: new ObjectId(ingredientId) },
      { $set: update }
    );

    // Update custom price if provided
    if (data.customPrice) {
      const customPrice: CustomPrice = {
        ...data.customPrice,
        updatedAt: new Date()
      };

      const scrapedIngredient = {
        ingredientId: new ObjectId(ingredientId),
        storeId: new ObjectId(),
        price: customPrice.amount,
        currency: customPrice.currency,
        quantity: customPrice.quantity,
        unit: customPrice.unit,
        store: {
          name: 'Custom Price'
        },
        validFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('scraped_ingredients').updateOne(
        {
          ingredientId: new ObjectId(ingredientId),
          'store.name': 'Custom Price'
        },
        { $set: scrapedIngredient },
        { upsert: true }
      );
    }
  }

  /**
   * Search ingredients
   */
  async searchIngredients(query: SearchIngredientsQuery): Promise<SearchResponse> {
    const db = await connectToDatabase();

    const filter: any = {
      $or: [
        { name: { $regex: query.query, $options: 'i' } },
        { description: { $regex: query.query, $options: 'i' } }
      ]
    };

    // Filter by source
    if (query.source?.length) {
      filter.source = { $in: query.source };
    }

    // Filter by country
    if (query.country?.length) {
      filter.sourceCountry = { $in: query.country };
    }

    // Handle private ingredients
    if (query.userId) {
      if (query.includePrivate) {
        filter.$or = [
          { isPublic: true },
          { createdBy: new ObjectId(query.userId) }
        ];
      } else {
        filter.isPublic = true;
      }
    } else {
      filter.isPublic = true;
    }

    const ingredients = await db.collection<Ingredient>('ingredients')
      .find(filter)
      .sort({ name: 1 })
      .skip(query.offset || 0)
      .limit(query.limit || 20)
      .toArray();

    const total = await db.collection<Ingredient>('ingredients')
      .countDocuments(filter);

    // If no results found, suggest creating a new ingredient
    if (total === 0) {
      return {
        ingredients: [],
        total: 0,
        createNew: {
          suggestion: `Create new ingredient "${query.query}"`,
          query: query.query
        }
      };
    }

    return {
      ingredients,
      total
    };
  }

  /**
   * Get ingredient prices
   */
  async getIngredientPrices(ingredientId: string): Promise<ScrapedIngredient[]> {
    const db = await connectToDatabase();

    const prices = await db.collection<ScrapedIngredient>('scraped_ingredients')
      .find({
        ingredientId: new ObjectId(ingredientId),
        validTo: { $exists: false }
      })
      .toArray();

    return prices;
  }

  /**
   * Upsert scraped ingredient
   */
  async upsertScrapedIngredient(
    storeId: string,
    externalId: string,
    data: {
      name: string;
      price: number;
      currency: string;
      quantity: number;
      unit: string;
      sourceCountry: string;
    }
  ): Promise<void> {
    const db = await connectToDatabase();

    // Find or create ingredient
    let ingredient = await db.collection<Ingredient>('ingredients').findOne({
      name: data.name,
      source: { $ne: 'user' }
    });

    if (!ingredient) {
      const newIngredient: Omit<Ingredient, '_id'> = {
        name: data.name,
        source: 'matspar',
        sourceCountry: data.sourceCountry,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await db.collection<Ingredient>('ingredients').insertOne(newIngredient);
      ingredient = { _id: result.insertedId, ...newIngredient };
    }

    // Update existing price if found
    const existingPrice = await db.collection<ScrapedIngredient>('scraped_ingredients').findOne({
      ingredientId: ingredient._id,
      storeId: new ObjectId(storeId),
      externalId,
      validTo: { $exists: false }
    });

    if (existingPrice) {
      if (
        existingPrice.price !== data.price ||
        existingPrice.currency !== data.currency ||
        existingPrice.quantity !== data.quantity ||
        existingPrice.unit !== data.unit
      ) {
        // Mark old price as invalid
        await db.collection('scraped_ingredients').updateOne(
          { _id: existingPrice._id },
          { $set: { validTo: new Date() } }
        );

        // Insert new price
        const store = await db.collection<Store>('stores').findOne({
          _id: new ObjectId(storeId)
        });

        if (!store) {
          throw new Error('Store not found');
        }

        await db.collection<ScrapedIngredient>('scraped_ingredients').insertOne({
          ingredientId: ingredient._id,
          storeId: new ObjectId(storeId),
          externalId,
          price: data.price,
          currency: data.currency,
          quantity: data.quantity,
          unit: data.unit,
          store: {
            name: store.name
          },
          validFrom: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } else {
      // Insert new price
      const store = await db.collection<Store>('stores').findOne({
        _id: new ObjectId(storeId)
      });

      if (!store) {
        throw new Error('Store not found');
      }

      await db.collection<ScrapedIngredient>('scraped_ingredients').insertOne({
        ingredientId: ingredient._id,
        storeId: new ObjectId(storeId),
        externalId,
        price: data.price,
        currency: data.currency,
        quantity: data.quantity,
        unit: data.unit,
        store: {
          name: store.name
        },
        validFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Delete an ingredient image
   */
  async deleteImage(url: string): Promise<void> {
    await this.imageService.deleteImage(url);
  }

  /**
   * Update an ingredient's custom price
   */
  async updateCustomPrice(ingredientId: string, customPrice: Omit<CustomPrice, 'updatedAt'>): Promise<void> {
    const db = await connectToDatabase();

    const scrapedIngredient: ScrapedIngredient = {
      ingredientId: new ObjectId(ingredientId),
      storeId: new ObjectId(),
      price: customPrice.amount,
      currency: customPrice.currency,
      quantity: customPrice.quantity,
      unit: customPrice.unit,
      store: {
        name: 'Custom Price'
      },
      validFrom: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update or insert custom price
    await db.collection<ScrapedIngredient>('scraped_ingredients').updateOne(
      {
        ingredientId: new ObjectId(ingredientId),
        'store.name': 'Custom Price'
      },
      {
        $set: scrapedIngredient
      },
      { upsert: true }
    );
  }
}

export default IngredientService; 

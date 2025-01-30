import { ObjectId } from 'mongodb';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb } from '../db.js';
import { redis } from '../lib/redis.js';
import { ScrapedIngredient } from '../types/ingredient.js';

export interface ScrapedPrice {
  price: number;
  oldPrice?: number;
  currency: string;
  quantity?: number;
  unit?: string;
  store: {
    name: string;
    logo?: string;
  };
  validFrom?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreConfig {
  baseUrl: string;
  searchEndpoint: string;
  selectors: {
    price: string;
    oldPrice?: string;
    name: string;
    image?: string;
  };
}

export class StoreScraper {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly STORE_CONFIGS: Record<string, StoreConfig> = {
    'matspar': {
      baseUrl: 'https://www.matspar.se',
      searchEndpoint: '/search',
      selectors: {
        price: '.product-price',
        oldPrice: '.product-price-old',
        name: '.product-name',
        image: '.product-image img'
      }
    }
  };

  constructor() {}

  async scrapeMatSparPrice(productName: string): Promise<ScrapedPrice | null> {
    try {
      // Check cache first
      const cacheKey = `price:matspar:${productName}`;
      const cachedPrice = await redis.get(cacheKey);
      if (cachedPrice) {
        return JSON.parse(cachedPrice);
      }

      const config = this.STORE_CONFIGS.matspar;
      const searchUrl = `${config.baseUrl}${config.searchEndpoint}?q=${encodeURIComponent(productName)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeApp/1.0; +http://example.com)'
        }
      });

      const $ = cheerio.load(response.data);
      const firstProduct = $(config.selectors.price).first();
      
      if (!firstProduct.length) {
        return null;
      }

      const price = parseFloat(firstProduct.text().replace(/[^0-9,.]/g, '').replace(',', '.'));
      const oldPriceElement = $(config.selectors.oldPrice).first();
      const oldPrice = oldPriceElement.length ? 
        parseFloat(oldPriceElement.text().replace(/[^0-9,.]/g, '').replace(',', '.')) : 
        undefined;

      const scrapedPrice: ScrapedPrice = {
        price,
        oldPrice,
        currency: 'SEK',
        quantity: 1,
        unit: 'st',
        store: {
          name: 'Matspar',
          logo: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg'
        },
        validFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Cache the result
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(scrapedPrice));

      return scrapedPrice;
    } catch (error) {
      console.error('Error scraping Matspar price:', error);
      return null;
    }
  }

  async scrapeStore(storeId: string): Promise<ScrapedIngredient[]> {
    const db = await getDb();
    const store = await db.collection('stores').findOne({ _id: new ObjectId(storeId) });
    
    if (!store || !this.STORE_CONFIGS[store.code]) {
      throw new Error('Store not found or scraping not supported');
    }

    // Implementation for other stores would go here
    return [];
  }
} 

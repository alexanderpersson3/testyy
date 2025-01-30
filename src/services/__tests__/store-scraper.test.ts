import { StoreScraper } from '../store-scraper';
import { redis } from '../../lib/redis';
import axios from 'axios';
import { ObjectId } from 'mongodb';
import { getDb } from '../../db.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../lib/redis');
jest.mock('../../db.js');

describe('StoreScraper', () => {
  let storeScraper: StoreScraper;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedRedis = redis as jest.Mocked<any>;

  beforeEach(() => {
    storeScraper = new StoreScraper();
    jest.clearAllMocks();
  });

  describe('scrapeMatSparPrice', () => {
    const productName = 'milk';
    const cacheKey = `price:matspar:${productName}`;

    it('should return cached price if available', async () => {
      const cachedPrice = {
        price: 15.90,
        oldPrice: 17.90,
        currency: 'SEK',
        quantity: 1,
        unit: 'st',
        store: {
          name: 'Matspar',
          logo: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg'
        }
      };

      mockedRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPrice));

      const result = await storeScraper.scrapeMatSparPrice(productName);
      expect(result).toEqual(cachedPrice);
      expect(mockedRedis.get).toHaveBeenCalledWith(cacheKey);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should scrape and cache new price if not cached', async () => {
      mockedRedis.get.mockResolvedValueOnce(null);
      
      const mockHtml = `
        <div class="product-price">15.90</div>
        <div class="product-price-old">17.90</div>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const expectedPrice = {
        price: 15.90,
        oldPrice: 17.90,
        currency: 'SEK',
        quantity: 1,
        unit: 'st',
        store: {
          name: 'Matspar',
          logo: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg'
        },
        validFrom: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      };

      const result = await storeScraper.scrapeMatSparPrice(productName);
      expect(result).toMatchObject(expectedPrice);
      expect(mockedRedis.get).toHaveBeenCalledWith(cacheKey);
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockedRedis.setex).toHaveBeenCalledWith(
        cacheKey,
        3600,
        expect.any(String)
      );
    });

    it('should handle missing old price', async () => {
      mockedRedis.get.mockResolvedValueOnce(null);
      
      const mockHtml = `
        <div class="product-price">15.90</div>
      `;

      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await storeScraper.scrapeMatSparPrice(productName);
      expect(result?.oldPrice).toBeUndefined();
      expect(result?.price).toBe(15.90);
    });

    it('should return null if product not found', async () => {
      mockedRedis.get.mockResolvedValueOnce(null);
      
      const mockHtml = `<div class="no-results"></div>`;
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await storeScraper.scrapeMatSparPrice(productName);
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockedRedis.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await storeScraper.scrapeMatSparPrice(productName);
      expect(result).toBeNull();
    });
  });

  describe('scrapeStore', () => {
    const storeId = new ObjectId().toString();

    it('should throw error if store not found', async () => {
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValueOnce(null)
        })
      };
      (getDb as jest.Mock).mockResolvedValueOnce(mockDb);

      await expect(storeScraper.scrapeStore(storeId))
        .rejects
        .toThrow('Store not found or scraping not supported');
    });

    it('should throw error if store scraping not supported', async () => {
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValueOnce({
            _id: new ObjectId(storeId),
            code: 'unsupported'
          })
        })
      };
      (getDb as jest.Mock).mockResolvedValueOnce(mockDb);

      await expect(storeScraper.scrapeStore(storeId))
        .rejects
        .toThrow('Store not found or scraping not supported');
    });

    it('should return empty array for valid store (placeholder)', async () => {
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValueOnce({
            _id: new ObjectId(storeId),
            code: 'matspar'
          })
        })
      };
      (getDb as jest.Mock).mockResolvedValueOnce(mockDb);

      const result = await storeScraper.scrapeStore(storeId);
      expect(result).toEqual([]);
    });
  });
}); 
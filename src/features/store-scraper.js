import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import dealManager from './deal-manager.js';
import axios from 'axios';
import cheerio from 'cheerio';

class StoreScraper {
  constructor() {
    // Store-specific configurations
    this.storeConfigs = {
      // Example store configurations
      ica: {
        baseUrl: 'https://www.ica.se',
        dealSelector: '.product-item.offer',
        priceSelector: '.price',
        titleSelector: '.product-name',
      },
      coop: {
        baseUrl: 'https://www.coop.se',
        dealSelector: '.product-card.campaign',
        priceSelector: '.price-value',
        titleSelector: '.product-title',
      },
      // Add more store configurations as needed
    };
  }

  /**
   * Scrape deals from a store's website
   * @param {string} storeId Store ID
   * @returns {Promise<Array>} Scraped deals
   */
  async scrapeStore(storeId) {
    try {
      const db = getDb();

      // Get store details
      const store = await db.collection('stores').findOne({
        _id: new ObjectId(storeId),
      });

      if (!store) {
        throw new Error('Store not found');
      }

      const config = this.storeConfigs[store.code];
      if (!config) {
        throw new Error('Store configuration not found');
      }

      // Fetch store's deals page
      const response = await axios.get(`${config.baseUrl}/deals`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeApp/1.0; +http://example.com)',
        },
      });

      const $ = cheerio.load(response.data);
      const deals = [];

      // Parse deals
      $(config.dealSelector).each((i, el) => {
        try {
          const deal = this.parseDealElement($, el, config);
          if (deal) {
            deals.push({
              ...deal,
              storeId: store._id,
            });
          }
        } catch (error) {
          console.error('Error parsing deal element:', error);
          // Continue with next element
        }
      });

      return deals;
    } catch (error) {
      console.error('Error scraping store:', error);
      throw error;
    }
  }

  /**
   * Parse a deal element from the DOM
   * @param {Object} $ Cheerio instance
   * @param {Object} element Deal element
   * @param {Object} config Store configuration
   * @returns {Object|null} Parsed deal or null
   */
  parseDealElement($, element, config) {
    try {
      const $el = $(element);

      // Extract prices
      const priceText = $el.find(config.priceSelector).text();
      const prices = this.extractPrices(priceText);

      if (!prices) {
        return null;
      }

      // Extract dates
      const dateText = $el.find('.campaign-dates').text();
      const dates = this.extractDates(dateText);

      if (!dates) {
        return null;
      }

      return {
        productId: new ObjectId($el.data('product-id')),
        title: $el.find(config.titleSelector).text().trim(),
        description: $el.find('.campaign-description').text().trim(),
        salePrice: prices.salePrice,
        normalPrice: prices.normalPrice,
        startDate: dates.startDate,
        endDate: dates.endDate,
        category: $el.data('category'),
        url: $el.find('a').attr('href'),
      };
    } catch (error) {
      console.error('Error parsing deal element:', error);
      return null;
    }
  }

  /**
   * Extract sale and normal prices from price text
   * @param {string} priceText Price text
   * @returns {Object|null} Extracted prices or null
   */
  extractPrices(priceText) {
    try {
      // Remove currency symbols and spaces
      const cleaned = priceText.replace(/[^0-9,.]/g, '');
      const prices = cleaned.split(',').map(p => parseFloat(p.trim()));

      if (prices.length < 2) {
        return null;
      }

      return {
        salePrice: Math.min(...prices),
        normalPrice: Math.max(...prices),
      };
    } catch (error) {
      console.error('Error extracting prices:', error);
      return null;
    }
  }

  /**
   * Extract start and end dates from date text
   * @param {string} dateText Date text
   * @returns {Object|null} Extracted dates or null
   */
  extractDates(dateText) {
    try {
      // Example format: "Valid 2024-01-15 - 2024-01-21"
      const matches = dateText.match(/(\d{4}-\d{2}-\d{2})/g);

      if (!matches || matches.length < 2) {
        return null;
      }

      return {
        startDate: new Date(matches[0]),
        endDate: new Date(matches[1]),
      };
    } catch (error) {
      console.error('Error extracting dates:', error);
      return null;
    }
  }

  /**
   * Update deals for all stores
   * @returns {Promise<Object>} Update results
   */
  async updateAllStores() {
    try {
      const db = getDb();
      const stores = await db.collection('stores').find({ isActive: true }).toArray();

      const results = {
        total: 0,
        byStore: {},
      };

      for (const store of stores) {
        try {
          const deals = await this.scrapeStore(store._id.toString());
          const processed = await dealManager.saveDealBatch(store._id, deals);

          results.total += processed;
          results.byStore[store.name] = processed;
        } catch (error) {
          console.error(`Error updating store ${store.name}:`, error);
          results.byStore[store.name] = 0;
        }
      }

      // Mark expired deals
      const expired = await dealManager.markExpiredDeals();
      results.expired = expired;

      return results;
    } catch (error) {
      console.error('Error updating all stores:', error);
      throw error;
    }
  }
}

export default new StoreScraper();

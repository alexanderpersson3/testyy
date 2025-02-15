import { logger } from '../logging.service.js';
import { ScrapedIngredient, Store } from '../../types/ingredient.js';
export class BaseScraper {
    constructor(store, baseUrl) {
        this.store = store;
        this.baseUrl = baseUrl;
        this.headers = {
            'User-Agent': 'Rezepta Price Aggregator/1.0',
            Accept: 'text/html,application/json',
            'Accept-Language': 'en-US,en;q=0.9',
        };
    }
    async validateStore() {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'HEAD',
                headers: this.headers,
            });
            return response.ok;
        }
        catch (error) {
            logger.error('Store validation failed', error);
            return false;
        }
    }
    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: { ...this.headers, ...options.headers },
                });
                if (response.ok) {
                    return response;
                }
                if (response.status === 429) {
                    // Rate limited
                    const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            catch (error) {
                if (i === retries - 1)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('Max retries reached');
    }
    sanitizePrice(price) {
        return parseFloat(price.replace(/[^0-9.,]/g, '').replace(',', '.'));
    }
    async delay(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
    generateUniqueId(storeId, externalId) {
        return `${storeId}_${externalId}`;
    }
}
//# sourceMappingURL=base.scraper.js.map
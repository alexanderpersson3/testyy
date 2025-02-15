import { JSDOM } from 'jsdom';
import { BaseScraper } from '../base.scraper.js';
import { logger } from '../logging.service.js';
import { Store, ScrapedIngredient } from '../../types/ingredient.js';
export class MatsparScraper extends BaseScraper {
    constructor(store) {
        super(store, 'https://www.matspar.se');
    }
    async fetchPrices(ingredientIds) {
        const results = [];
        for (const id of ingredientIds) {
            try {
                // Fetch product details from Matspar's API
                const response = await this.fetchWithRetry(`${this.baseUrl}/api/products/${id}`);
                const product = (await response.json());
                results.push({
                    ingredientId: new ObjectId(id),
                    storeId: this.store._id,
                    externalId: product.id,
                    price: product.price,
                    oldPrice: product.oldPrice,
                    currency: 'SEK',
                    quantity: product.quantity,
                    unit: product.unit,
                    store: {
                        name: this.store.name,
                        logo: this.store.logo,
                    },
                    validFrom: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                // Respect rate limits
                await this.delay(500);
            }
            catch (error) {
                logger.error(`Failed to fetch price for ingredient ${id}`, error);
            }
        }
        return results;
    }
    async fetchDeals() {
        try {
            // Fetch deals page
            const response = await this.fetchWithRetry(`${this.baseUrl}/erbjudanden`);
            const html = await response.text();
            // Parse deals from HTML
            const deals = await this.parseHTML(html);
            const results = [];
            for (const deal of deals) {
                try {
                    results.push({
                        ingredientId: new ObjectId(), // This would need to be mapped to your ingredient
                        storeId: this.store._id,
                        externalId: deal.id,
                        price: deal.price,
                        oldPrice: deal.oldPrice,
                        currency: 'SEK',
                        quantity: deal.quantity,
                        unit: deal.unit,
                        store: {
                            name: this.store.name,
                            logo: this.store.logo,
                        },
                        validFrom: new Date(),
                        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }
                catch (error) {
                    logger.error('Failed to process deal', error);
                }
            }
            return results;
        }
        catch (error) {
            logger.error('Failed to fetch deals', error);
            return [];
        }
    }
    async parseHTML(html) {
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const products = [];
        // Find all product cards
        const productCards = document.querySelectorAll('.product-card');
        for (const card of productCards) {
            try {
                const id = card.getAttribute('data-product-id') || '';
                const name = card.querySelector('.product-name')?.textContent?.trim() || '';
                const priceText = card.querySelector('.price')?.textContent?.trim() || '0';
                const oldPriceText = card.querySelector('.old-price')?.textContent?.trim();
                const unitText = card.querySelector('.unit')?.textContent?.trim() || '';
                const quantityText = card.querySelector('.quantity')?.textContent?.trim() || '1';
                const imageUrl = card.querySelector('img')?.getAttribute('src');
                products.push({
                    id,
                    name,
                    price: this.sanitizePrice(priceText),
                    oldPrice: oldPriceText ? this.sanitizePrice(oldPriceText) : undefined,
                    unit: unitText,
                    quantity: parseFloat(quantityText),
                    imageUrl: imageUrl || undefined,
                });
            }
            catch (error) {
                logger.error('Failed to parse product card', error);
            }
        }
        return products;
    }
}
//# sourceMappingURL=matspar.scraper.js.map
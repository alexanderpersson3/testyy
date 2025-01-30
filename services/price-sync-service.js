const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class PriceSyncService {
  constructor() {
    this.STORE_MAPPINGS = {
      1: 'ICA',
      2: 'Coop',
      3: 'MatHem',
      4: 'Willys'
    };
  }

  async syncRecipePrices() {
    const db = getDb();
    console.log('Starting recipe price synchronization...');
    
    try {
      // Get all recipes that need price updates
      const recipes = await db.collection('recipes')
        .find({
          $or: [
            { last_price_sync: { $exists: false } },
            { last_price_sync: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Older than 24h
          ]
        })
        .toArray();

      console.log(`Found ${recipes.length} recipes to update`);
      const updates = [];

      for (const recipe of recipes) {
        const updatedIngredients = await this.updateRecipeIngredients(recipe);
        if (updatedIngredients) {
          updates.push({
            updateOne: {
              filter: { _id: recipe._id },
              update: { 
                $set: { 
                  ingredients: updatedIngredients,
                  last_price_sync: new Date()
                }
              }
            }
          });
        }
      }

      if (updates.length > 0) {
        const result = await db.collection('recipes').bulkWrite(updates);
        console.log(`Updated ${result.modifiedCount} recipes`);
      }

      return { 
        success: true, 
        updated: updates.length,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error in syncRecipePrices:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async updateRecipeIngredients(recipe) {
    const db = getDb();
    const updatedIngredients = [];
    let hasUpdates = false;

    for (const ingredient of recipe.ingredients) {
      try {
        // Find matching products from the scraper data
        const matchingProducts = await db.collection('products')
          .find({
            $text: { 
              $search: ingredient.name,
              $caseSensitive: false,
              $diacriticSensitive: false
            }
          })
          .limit(10)
          .toArray();

        if (matchingProducts.length > 0) {
          const products = matchingProducts.map(product => ({
            id: product.productid,
            name: product.name,
            image: product.image,
            brand: product.brand,
            unit: product.unit,
            prices: this.formatPrices(product.prices),
            price_history: this.getLatestPriceHistory(product.price_history),
            last_updated: product.last_updated || new Date()
          }));

          const bestPrices = this.calculateBestPrices(products);
          
          updatedIngredients.push({
            ...ingredient,
            products,
            best_prices: bestPrices,
            last_updated: new Date()
          });
          hasUpdates = true;
        } else {
          updatedIngredients.push(ingredient);
        }
      } catch (error) {
        console.error(`Error updating ingredient ${ingredient.name}:`, error);
        updatedIngredients.push(ingredient);
      }
    }

    return hasUpdates ? updatedIngredients : null;
  }

  formatPrices(prices) {
    if (!prices) return [];
    
    return Object.entries(prices)
      .filter(([storeId, price]) => price && !isNaN(parseFloat(price)))
      .map(([storeId, price]) => ({
        store: {
          id: parseInt(storeId),
          name: this.STORE_MAPPINGS[storeId] || 'Unknown'
        },
        price: parseFloat(price),
        unit_price: price.unit_price ? parseFloat(price.unit_price) : null,
        currency: 'SEK'
      }));
  }

  getLatestPriceHistory(history) {
    if (!history || !Array.isArray(history)) return [];
    
    // Get last 30 days of price history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return history
      .filter(entry => new Date(entry.timestamp) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30);
  }

  calculateBestPrices(products) {
    const storesPrices = {};

    products.forEach(product => {
      product.prices.forEach(priceInfo => {
        const storeId = priceInfo.store.id;
        if (!storesPrices[storeId] || priceInfo.price < storesPrices[storeId].price) {
          storesPrices[storeId] = {
            product_id: product.id,
            product_name: product.name,
            store: priceInfo.store,
            price: priceInfo.price,
            unit_price: priceInfo.unit_price,
            currency: priceInfo.currency
          };
        }
      });
    });

    return Object.values(storesPrices);
  }

  async updatePriceAlerts() {
    const db = getDb();
    console.log('Checking price alerts...');
    
    try {
      const alerts = await db.collection('price_alerts').find({
        active: true,
        next_check: { $lte: new Date() }
      }).toArray();

      console.log(`Found ${alerts.length} active alerts to check`);
      const notifications = [];

      for (const alert of alerts) {
        const product = await db.collection('products').findOne({
          productid: alert.product_id
        });

        if (product) {
          const currentPrice = this.getCurrentPrice(product, alert.store_id);
          
          if (currentPrice) {
            const priceChange = {
              previous_price: alert.last_price || null,
              current_price: currentPrice,
              change_percentage: alert.last_price ? 
                ((currentPrice - alert.last_price) / alert.last_price) * 100 : 0
            };

            if (this.shouldTriggerAlert(alert, currentPrice, priceChange)) {
              notifications.push({
                user_id: alert.user_id,
                type: 'PRICE_ALERT',
                title: this.getAlertTitle(alert, currentPrice, priceChange),
                message: this.getAlertMessage(product, alert, currentPrice, priceChange),
                data: {
                  product_id: product.productid,
                  store_id: alert.store_id,
                  price: currentPrice,
                  price_change: priceChange,
                  alert_id: alert._id
                },
                created_at: new Date()
              });

              await this.updateAlertStatus(alert, currentPrice);
            }

            await db.collection('price_alerts').updateOne(
              { _id: alert._id },
              { 
                $set: { 
                  last_price: currentPrice,
                  last_check: new Date(),
                  next_check: this.getNextCheckDate(alert)
                }
              }
            );
          }
        }
      }

      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
        console.log(`Created ${notifications.length} price alert notifications`);
      }

      return {
        success: true,
        alerts_checked: alerts.length,
        notifications_sent: notifications.length,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error in updatePriceAlerts:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  shouldTriggerAlert(alert, currentPrice, priceChange) {
    switch (alert.type) {
      case 'PRICE_DROP':
        return currentPrice <= alert.target_price;
      case 'PRICE_CHANGE':
        return Math.abs(priceChange.change_percentage) >= alert.threshold_percentage;
      case 'PRICE_RISE':
        return currentPrice >= alert.target_price;
      default:
        return false;
    }
  }

  getAlertTitle(alert, currentPrice, priceChange) {
    switch (alert.type) {
      case 'PRICE_DROP':
        return 'Price Drop Alert';
      case 'PRICE_CHANGE':
        return `Price ${priceChange.change_percentage > 0 ? 'Increase' : 'Decrease'} Alert`;
      case 'PRICE_RISE':
        return 'Price Rise Alert';
      default:
        return 'Price Alert';
    }
  }

  getAlertMessage(product, alert, currentPrice, priceChange) {
    const storeName = this.STORE_MAPPINGS[alert.store_id];
    const changeText = priceChange.previous_price ? 
      ` (${priceChange.change_percentage > 0 ? '+' : ''}${priceChange.change_percentage.toFixed(1)}% from ${priceChange.previous_price} SEK)` : '';
    
    return `${product.name} is now ${currentPrice} SEK at ${storeName}${changeText}`;
  }

  async updateAlertStatus(alert, currentPrice) {
    const db = getDb();
    if (alert.type === 'PRICE_DROP' || alert.type === 'PRICE_RISE') {
      await db.collection('price_alerts').updateOne(
        { _id: alert._id },
        { 
          $set: { 
            active: false,
            triggered_at: new Date()
          }
        }
      );
    }
  }

  getNextCheckDate(alert) {
    const now = new Date();
    now.setHours(now.getHours() + 24);
    return now;
  }

  getCurrentPrice(product, storeId) {
    if (!product.prices || !product.prices[storeId]) return null;
    return parseFloat(product.prices[storeId]);
  }
}

module.exports = new PriceSyncService(); 
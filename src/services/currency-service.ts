import axios from 'axios';

interface ExchangeRates {
  [key: string]: number;
}

class CurrencyService {
  private rates: ExchangeRates = {};
  private lastUpdate: Date | null = null;
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get current exchange rates
   */
  private async updateRates(): Promise<void> {
    // Skip update if rates are fresh
    if (
      this.lastUpdate &&
      Date.now() - this.lastUpdate.getTime() < this.UPDATE_INTERVAL
    ) {
      return;
    }

    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/SEK`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.EXCHANGE_RATE_API_KEY}`
          }
        }
      );

      this.rates = response.data.rates;
      this.lastUpdate = new Date();
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      throw new Error('Failed to update exchange rates');
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    await this.updateRates();

    // Same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert through SEK as base currency
    const amountInSEK = fromCurrency === 'SEK' 
      ? amount 
      : amount / this.rates[fromCurrency];
    
    const result = toCurrency === 'SEK'
      ? amountInSEK
      : amountInSEK * this.rates[toCurrency];

    return Math.round(result * 100) / 100; // Round to 2 decimals
  }

  /**
   * Format price with currency symbol
   */
  formatPrice(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency
    });

    return formatter.format(amount);
  }
}

export default CurrencyService; 
declare class CurrencyService {
    private rates;
    private lastUpdate;
    private readonly UPDATE_INTERVAL;
    /**
     * Get current exchange rates
     */
    private updateRates;
    /**
     * Convert amount from one currency to another
     */
    convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number>;
    /**
     * Format price with currency symbol
     */
    formatPrice(amount: number, currency: string): string;
}
export default CurrencyService;
//# sourceMappingURL=currency-service.d.ts.map
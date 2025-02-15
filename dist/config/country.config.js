const countryConfig = {
    SE: {
        stores: ['matspar'],
        currency: 'SEK',
        defaultLanguage: 'sv',
        supportedLanguages: ['sv', 'en'],
        timezone: 'Europe/Stockholm',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    DE: {
        stores: ['rewe', 'edeka'],
        currency: 'EUR',
        defaultLanguage: 'de',
        supportedLanguages: ['de', 'en'],
        timezone: 'Europe/Berlin',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    FR: {
        stores: ['carrefour', 'auchan'],
        currency: 'EUR',
        defaultLanguage: 'fr',
        supportedLanguages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    IT: {
        stores: ['esselunga', 'coop'],
        currency: 'EUR',
        defaultLanguage: 'it',
        supportedLanguages: ['it', 'en'],
        timezone: 'Europe/Rome',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    ES: {
        stores: ['mercadona', 'carrefour'],
        currency: 'EUR',
        defaultLanguage: 'es',
        supportedLanguages: ['es', 'en'],
        timezone: 'Europe/Madrid',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    NO: {
        stores: ['rema1000', 'kiwi'],
        currency: 'NOK',
        defaultLanguage: 'no',
        supportedLanguages: ['no', 'en'],
        timezone: 'Europe/Oslo',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    DK: {
        stores: ['netto', 'fotex'],
        currency: 'DKK',
        defaultLanguage: 'dk',
        supportedLanguages: ['dk', 'en'],
        timezone: 'Europe/Copenhagen',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
    FI: {
        stores: ['smarket', 'kmarket'],
        currency: 'EUR',
        defaultLanguage: 'fi',
        supportedLanguages: ['fi', 'sv', 'en'],
        timezone: 'Europe/Helsinki',
        priceUpdateFrequency: 24,
        dealUpdateFrequency: 12,
    },
};
export const SUPPORTED_COUNTRIES = Object.keys(countryConfig);
export const DEFAULT_COUNTRY = 'SE';
export default countryConfig;
//# sourceMappingURL=country.config.js.map
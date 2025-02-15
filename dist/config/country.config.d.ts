export interface CountryConfig {
    stores: string[];
    currency: string;
    defaultLanguage: string;
    supportedLanguages: string[];
    timezone: string;
    priceUpdateFrequency: number;
    dealUpdateFrequency: number;
}
declare const countryConfig: Record<string, CountryConfig>;
export declare const SUPPORTED_COUNTRIES: string[];
export declare const DEFAULT_COUNTRY = "SE";
export default countryConfig;

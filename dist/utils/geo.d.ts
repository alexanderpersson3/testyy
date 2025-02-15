interface GeoLocation {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: [number, number];
}
export declare function getLocationFromIP(ip: string): Promise<GeoLocation>;
export declare function calculateDistance(coord1: [number, number], coord2: [number, number]): number;
export declare function isLocationAllowed(location: GeoLocation, allowedCountries?: string[], blockedCountries?: string[]): boolean;
export {};

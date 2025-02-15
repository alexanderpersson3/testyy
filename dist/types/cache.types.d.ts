export interface CacheConfig {
    ttl: number;
    prefix?: string;
}
export interface CacheEntry<T> {
    data: T;
    expires: number;
}
export interface CacheOptions {
    ttl: number;
    tags?: string[];
    prefix?: string;
}

import { RateLimitRequestHandler } from 'express-rate-limit';
interface RateLimitConfig {
    windowMs: number;
    max: number;
    message: string;
}
interface RateLimitMiddleware {
    auth: () => RateLimitRequestHandler;
    api: () => RateLimitRequestHandler;
    scraping: () => RateLimitRequestHandler;
    custom: (config: RateLimitConfig) => RateLimitRequestHandler;
}
export declare const rateLimitMiddleware: RateLimitMiddleware;
export declare const rateLimiter: RateLimitMiddleware;
export {};
//# sourceMappingURL=rate-limit.d.ts.map
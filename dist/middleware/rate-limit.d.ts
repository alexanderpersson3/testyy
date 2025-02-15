interface RateLimitOptions {
    windowMs: number;
    max: number;
    keyPrefix: string;
    handler?: (req: Request, res: Response) => void;
    skipFailedRequests?: boolean;
    requestPropertyName?: string;
}
interface RateLimitInfo {
    limit: number;
    current: number;
    remaining: number;
    resetTime: number;
}
interface RateLimitRequest extends Request {
    rateLimit?: RateLimitInfo;
    [key: string]: any;
}
export declare const rateLimitMiddleware: {
    auth: (options?: Partial<RateLimitOptions>) => (req: RateLimitRequest, res: Response, next: NextFunction) => Promise<void>;
    api: (options?: Partial<RateLimitOptions>) => (req: RateLimitRequest, res: Response, next: NextFunction) => Promise<void>;
    custom: (options: Partial<RateLimitOptions>) => (req: RateLimitRequest, res: Response, next: NextFunction) => Promise<void>;
};
/**
 * Clean up rate limit data
 */
export declare function cleanupRateLimits(): Promise<void>;
export {};

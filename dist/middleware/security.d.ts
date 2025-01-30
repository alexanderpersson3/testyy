import { Request, Response, NextFunction } from 'express';
export declare const securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
};
export declare const globalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimiter: (maxSize?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map
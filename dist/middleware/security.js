import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
export class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
export const setupSecurity = (app) => {
    // Basic security headers
    app.use(helmet());
    // CORS configuration
    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400, // 24 hours
    }));
    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
    });
    // Apply rate limiting to all routes
    app.use(limiter);
    // Disable X-Powered-By header
    app.disable('x-powered-by');
    // Content Security Policy
    app.use(helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    }));
    // HTTP Strict Transport Security
    app.use(helmet.hsts({
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    }));
    // Prevent clickjacking
    app.use(helmet.frameguard({ action: 'deny' }));
    // Prevent MIME type sniffing
    app.use(helmet.noSniff());
    // XSS protection
    app.use(helmet.xssFilter());
    // Referrer policy
    app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
    // Feature Policy
    app.use(helmet.permittedCrossDomainPolicies());
    // DNS Prefetch Control
    app.use(helmet.dnsPrefetchControl());
};
// API key validation for external services
export const validateApiKey = (req, res, next) => {
    const apiKey = req.header('X-API-Key');
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        throw new AppError(401, 'Invalid API key');
    }
    next();
};
// Request size limiter
export const requestSizeLimiter = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.header('content-length') || '0');
        const maxBytes = parseFileSize(maxSize);
        if (contentLength > maxBytes) {
            throw new AppError(413, 'Request entity too large');
        }
        next();
    };
};
// Helper function to parse file size strings (e.g., '10mb' to bytes)
function parseFileSize(size) {
    const units = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024,
    };
    const match = size.match(/^(\d+)([kmg]?b)$/i);
    if (!match) {
        throw new Error('Invalid file size format');
    }
    const [, value, unit] = match;
    return parseInt(value) * units[unit.toLowerCase()];
}
// SQL injection protection middleware
export const sqlInjectionProtection = (req, res, next) => {
    const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|('|--|#|\/\*|\*\/)/i;
    const { query, body, params } = req;
    const checkValue = (value) => {
        if (typeof value === 'string' && sqlInjectionPattern.test(value)) {
            return true;
        }
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(v => checkValue(v));
        }
        return false;
    };
    if (checkValue(query) || checkValue(body) || checkValue(params)) {
        return res.status(400).json({
            error: 'Potential SQL injection detected',
        });
    }
    next();
};
// XSS protection middleware
export const xssProtection = (req, res, next) => {
    const xssPattern = /<[^>]*>|javascript:|data:|vbscript:|on\w+=/i;
    const { query, body, params } = req;
    const checkValue = (value) => {
        if (typeof value === 'string' && xssPattern.test(value)) {
            return true;
        }
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(v => checkValue(v));
        }
        return false;
    };
    if (checkValue(query) || checkValue(body) || checkValue(params)) {
        return res.status(400).json({
            error: 'Potential XSS attack detected',
        });
    }
    next();
};
//# sourceMappingURL=security.js.map
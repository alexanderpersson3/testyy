import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createStructuredLog, reportError } from './cloud.js';

// Rate limiting configuration
const rateLimiter = {
  // API rate limiter
  api: () => rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    handler: (req, res) => {
      createStructuredLog('WARNING', 'Rate limit exceeded', {
        ip: req.ip,
        path: req.path
      });
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
      });
    }
  }),

  // Stricter rate limiter for auth endpoints
  auth: () => rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 failed attempts per hour
    message: 'Too many failed attempts, please try again later',
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      createStructuredLog('WARNING', 'Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path
      });
      res.status(429).json({
        error: 'Too many failed attempts',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
      });
    }
  })
};

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  expectCt: {
    maxAge: 30,
    enforce: true
  },
  frameguard: {
    action: "deny"
  },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
});

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      'https://api.rezepta.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      createStructuredLog('WARNING', 'CORS origin rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 600 // 10 minutes
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      next();
    } catch (error) {
      reportError(error, {
        path: req.path,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body
      });
      res.status(400).json({
        error: 'Invalid request',
        details: error.errors
      });
    }
  };
};

// IP filtering middleware
const ipFilter = (req, res, next) => {
  const clientIP = req.ip;
  const blockedIPs = process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [];
  
  if (blockedIPs.includes(clientIP)) {
    createStructuredLog('WARNING', 'Blocked IP attempted access', { ip: clientIP });
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove any script tags
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Remove any HTML tags
        obj[key] = obj[key].replace(/<[^>]*>/g, '');
        // Remove any SQL injection attempts
        obj[key] = obj[key].replace(/(\b(select|insert|update|delete|drop|union|exec|declare)\b)/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
};

export {
  rateLimiter,
  securityHeaders,
  corsOptions,
  validateRequest,
  ipFilter,
  sanitizeRequest
}; 
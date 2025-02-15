import cors from 'cors';
import connect, { DatabaseConnection } from './db';
import { client as elasticClient } from './services/elastic-client';
import { createStructuredLog } from './config/cloud';
import helmet from 'helmet';
import rateLimiters from './middleware/rate-limit';
import { performanceMiddleware } from './services/performance-monitor';
import monitoringRoutes from './routes/monitoring';
import performanceTestRoutes from './routes/performance-test';
import { setupErrorHandling } from './middleware/error-handler';
import { AppError } from './utils/errors';
import authRoutes from './routes/auth';
import compression from 'compression';
import morgan from 'morgan';
import { adminRoutes } from './features/admin/index.js';
import { errorHandler } from './core/middleware/error.middleware.js';

import express, { Request, Response, NextFunction, Application } from 'express';
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Apply rate limiters
app.use('/api/auth', rateLimiters.auth);
app.use('/api', rateLimiters.api);
app.use('/', rateLimiters.public);

// Health check endpoint
app.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await (connect as DatabaseConnection | null)!.getDb();
    const dbHealthy = await db.command({ ping: 1 });

    const elasticHealthy = await elasticClient.ping();

    const status = dbHealthy && elasticHealthy ? 'healthy' : 'degraded';

    const healthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        cache: elasticHealthy ? 'healthy' : 'unhealthy',
      },
    };

    createStructuredLog('health_check', JSON.stringify(healthStatus));

    res.status(status === 'healthy' ? 200 : 207).json(healthStatus);
  } catch (error: any) {
    createStructuredLog('health_check_error', JSON.stringify({ error: error.message }));
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Add performance monitoring middleware before routes
app.use(performanceMiddleware);

// Use routes
app.use('/api/auth', authRoutes);

// Add monitoring routes
app.use('/monitoring', monitoringRoutes);

// Add performance test routes (admin only)
app.use('/performance-test', performanceTestRoutes);

// Routes
app.use('/api/admin', adminRoutes);

// 404 handler
app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(
    new AppError(
      `Cannot find ${req.method} ${req.originalUrl} on this server`,
      404,
      'ROUTE_NOT_FOUND'
    )
  );
});

// Setup error handling (this replaces the existing error handler)
setupErrorHandling(app);

// Export both named and default for different use cases
export { app };
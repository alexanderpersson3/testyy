import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import 'dotenv/config';
import * as http from 'http';
import { Socket } from 'net';
import { connectToDatabase } from '@/db/database.service.js';
import { setupRoutes } from '@/routes/index.js';
import { setupMiddleware } from '@/middleware/index.js';
import { setupSecurity } from '@/middleware/security.js';
import { setupLogging } from '@/middleware/logging.js';
import logger from '@/utils/logger.js';
import { errorHandler } from '@/middleware/error-handler.js';
import { WebSocketService } from '@/services/websocket-service.js';
import { MonitoringService } from '@/services/monitoring.service.js';
import { CronService } from '@/services/cron/cron.service.js';
import instrument from '@/utils/instrument.js';
import { createIndexes } from '@/db/indexes.js';
import { ensureConnection } from '@/db/index.js';
import { config } from '@/config/index.js';
import { errorHandler as newErrorHandler } from '@/middleware/error-handler.js';
import { rateLimiter } from '@/middleware/rate-limiter.js';
import { requestLogger } from '@/middleware/request-logger.js';
import authRoutes from '@/routes/auth.js';
import userRoutes from '@/routes/users.js';
import recipeRoutes from '@/routes/recipe/index.js';
import shoppingListRoutes from '@/routes/shopping-list.js';
import commentRoutes from '@/routes/comments.js';
import priceTrackingRoutes from '@/routes/price-tracking.js';
import profileRoutes from '@/routes/profile.js';
import videoRoutes from '@/routes/video.js';
import mealPlanningRoutes from '@/routes/meal-plans.js';
import cmsRoutes from '@/routes/admin/cms.routes.js';
import recipeImportRoutes from '@/routes/admin/recipe-import.routes.js';
import moderationRoutes from '@/routes/admin/moderation.routes.js';
import searchRoutes from '@/routes/search.routes.js';
const app = express();
// Initialize Sentry instrumentation
instrument(app);
// Initialize monitoring service
const monitoringService = MonitoringService.getInstance();
// The request handler must be the first middleware on the app
app.use(monitoringService.getRequestHandler());
// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));
// Basic middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);
// Setup logging and security middleware
setupLogging(app);
setupSecurity(app);
// Setup routes
setupMiddleware(app);
setupRoutes(app);
// Serve uploaded files
app.use('/uploads', express.static('uploads'));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/prices', priceTrackingRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/meal-plans', mealPlanningRoutes);
app.use('/api/admin/cms', cmsRoutes);
app.use('/api/admin/recipes', recipeImportRoutes);
app.use('/api/admin/moderation', moderationRoutes);
app.use('/api/search', searchRoutes);
// The error handler must be before any other error middleware and after all controllers
app.use(monitoringService.getErrorHandler());
// Error handling
app.use(newErrorHandler);
// 404 handler
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
const startServer = async () => {
    try {
        let port = 3001; // Force use port 3001
        let server = null;
        // Add explicit console logging for startup
        logger.info(`Attempting to start server on port ${port}`);
        // Try the main port and fallback ports
        const tryPort = async (p) => {
            try {
                return await new Promise((resolve, reject) => {
                    const s = app.listen(p, () => resolve(s))
                        .on('error', (err) => {
                        if (err.code === 'EADDRINUSE') {
                            resolve(null);
                        }
                        else {
                            reject(err);
                        }
                    });
                });
            }
            catch (error) {
                logger.error('Error starting server:', error instanceof Error ? error : new Error('Unknown error'));
                return null;
            }
        };
        // Try main port first
        server = await tryPort(port);
        // If main port fails, try fallback ports
        const fallbackPorts = [3002, 3003, 3004];
        if (!server) {
            for (const fallbackPort of fallbackPorts) {
                server = await tryPort(fallbackPort);
                if (server) {
                    port = fallbackPort;
                    break;
                }
            }
        }
        if (!server) {
            throw new Error('Could not find an available port');
        }
        // Initialize database connection
        await connectToDatabase();
        await createIndexes();
        // Set up WebSocket server
        const wsService = WebSocketService.getInstance();
        // Handle WebSocket upgrade requests
        server.on('upgrade', (request, socket, head) => {
            const { pathname } = new URL(request.url || '', `ws://${request.headers.host}`);
            if (pathname === '/ws' || pathname === '/') {
                wsService.handleUpgrade(request, socket, head);
                logger.info(`WebSocket connection established at path: ${pathname}`);
            }
            else {
                socket.destroy();
            }
        });
        // Initialize cron jobs
        const cronService = CronService.getInstance();
        cronService.initialize();
        logger.info('Cron jobs initialized');
        // Ensure database connection before starting server
        await ensureConnection();
        logger.info(`Server is running on port ${port}`);
    }
    catch (error) {
        logger.error('Failed to start server:', error instanceof Error ? error : new Error('Unknown error'));
        process.exit(1);
    }
};
// Start server if this is not imported as a module
const isImported = process.env.NODE_ENV === 'test' || process.env.IS_IMPORTED;
if (!isImported) {
    startServer();
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received.');
    // Stop cron jobs
    const cronService = CronService.getInstance();
    cronService.stopAll();
    logger.info('Cron jobs stopped');
    // Close Sentry
    await monitoringService.close();
    // ... existing shutdown logic ...
});
export default app;
//# sourceMappingURL=App.js.map
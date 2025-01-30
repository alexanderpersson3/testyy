/**
 * Main application entry point
 *
 * Note on ESM imports:
 * We use .js extensions in imports (e.g., './routes/auth.js') even though the source files are .ts
 * This is required because:
 * 1. We're using ESM modules (package.json "type": "module")
 * 2. TypeScript is configured with "moduleResolution": "NodeNext"
 * 3. At runtime, the compiled files will be .js
 *
 * TypeScript may show linter errors about not finding modules with .js extensions,
 * but this can be safely ignored as it's a known limitation of TypeScript's
 * module resolution when using ESM. The code will work correctly both in:
 * - Development (tsx handles this properly)
 * - Production (tsc compiles .ts to .js)
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createServer } from 'http';
import { connectToDatabase } from './db/db.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityHeaders, corsOptions, globalRateLimit, requestSizeLimiter, sqlInjectionProtection } from './middleware/security.js';
import { initializeWebSocket } from './services/websocket.js';
import { initializeCollectionWebSocket } from './services/collection-websocket.js';
import helmet from 'helmet';
import compression from 'compression';
// Import routes
import authRouter from './routes/auth.js';
import recipesRouter from './routes/recipes.js';
import ingredientsRouter from './routes/ingredients.js';
import shoppingListRouter from './routes/shopping-list.js';
import storesRouter from './routes/stores.js';
import searchRouter from './routes/search.js';
import socialRouter from './routes/social.js';
import offlineRouter from './routes/offline.js';
import syncRouter from './routes/sync.js';
import analyticsRouter from './routes/analytics.js';
// Create Express app
const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;
// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(globalRateLimit);
app.use(requestSizeLimiter('10mb'));
app.use(sqlInjectionProtection);
// Configure helmet middleware
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
};
app.use(helmet(helmetConfig));
// Configure compression middleware
const compressionHandler = compression();
app.use(compressionHandler);
// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', authRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/shopping', shoppingListRouter);
app.use('/api/stores', storesRouter);
app.use('/api/search', searchRouter);
app.use('/api/social', socialRouter);
app.use('/api/offline', offlineRouter);
app.use('/api/sync', syncRouter);
app.use('/api/analytics', analyticsRouter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handling
app.use(errorHandler);
// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectToDatabase();
        console.log('Connected to MongoDB');
        // Initialize WebSocket services
        initializeWebSocket(server, '/ws');
        initializeCollectionWebSocket(server);
        console.log('WebSocket servers initialized');
        // Start listening
        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Only start server if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    startServer();
}
export default app;
//# sourceMappingURL=app.js.map
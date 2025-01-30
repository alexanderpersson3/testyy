import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import { elasticClient } from './services/elastic-client.js';
import { createStructuredLog } from './config/cloud.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const db = await connect();
    const dbHealthy = await db.command({ ping: 1 });
    
    const elasticHealthy = await elasticClient.ping();
    
    const status = dbHealthy && elasticHealthy ? 'healthy' : 'degraded';
    
    const healthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        cache: elasticHealthy ? 'healthy' : 'unhealthy'
      }
    };

    createStructuredLog('health_check', healthStatus);
    
    res.status(status === 'healthy' ? 200 : 207).json(healthStatus);
  } catch (error) {
    createStructuredLog('health_check_error', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Import routes
import authRoutes from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import userRoutes from './routes/users.js';
import ingredientRoutes from './routes/ingredients.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import priceAlertRoutes from './routes/price-alerts.js';
import analyticsRoutes from './routes/analytics.js';

// Use routes
app.use('/auth', authRoutes);
app.use('/recipes', recipeRoutes);
app.use('/users', userRoutes);
app.use('/ingredients', ingredientRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationRoutes);
app.use('/price-alerts', priceAlertRoutes);
app.use('/analytics', analyticsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  createStructuredLog('error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

export default app; 
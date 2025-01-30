require('dotenv').config();
const express = require('express');
const recipeRouter = require('./rezapta');
const authRouter = require('./auth');
const { router: priceRouter } = require('./price');
const { connectToDb } = require('./connectDB');
const { errorHandler } = require('./middleware/errorHandler');
const recipeVersionsRouter = require('./routes/recipe-versions');
const recipeSearchRouter = require('./routes/recipe-search');
const reputationRouter = require('./routes/reputation');
const userIngredientsRouter = require('./routes/user-ingredients');
const scheduledPricesRouter = require('./routes/scheduled-prices');
const scheduler = require('./services/scheduler');
const featuredRecipesRouter = require('./routes/featured-recipes');
const queryOptimizationRouter = require('./routes/admin/query-optimization');
const queryOptimizer = require('./services/query-optimizer');
const auditLogger = require('./services/audit-logger');
const auditLogsRouter = require('./routes/admin/audit-logs');
const rateLimiter = require('./middleware/rate-limit');
const reviewsRouter = require('./routes/reviews');
const subscriptionsRouter = require('./routes/subscriptions');
const mediaRouter = require('./routes/media');
const analyticsRouter = require('./routes/admin/analytics');
const { trackApiMetrics, trackErrors, trackPageView } = require('./middleware/analytics');
const integrationsRouter = require('./routes/admin/integrations');
const usersRouter = require('./routes/users');
const feedRouter = require('./routes/feed');
const mealPlansRouter = require('./routes/meal-plans');
const passwordResetRouter = require('./routes/auth/password-reset');
const emailVerificationRouter = require('./routes/auth/email-verification');
const sessionsRouter = require('./routes/auth/sessions');
const accountRouter = require('./routes/auth/account');
const twoFactorRouter = require('./routes/auth/two-factor');
const moderationRouter = require('./routes/moderation');
const adminModerationRouter = require('./routes/admin/moderation');
const notificationPreferencesRouter = require('./routes/users/notification-preferences');
const devicesRouter = require('./routes/users/devices');
const localizationRouter = require('./routes/users/localization');
const complianceRouter = require('./routes/users/compliance');
const paymentRouter = require('./routes/users/payments');
const onboardingRouter = require('./routes/users/onboarding');
const userAnalyticsRouter = require('./routes/admin/user-analytics');

const app = express();
const port = process.env.PORT || 3000;

// Set environment
app.set('env', process.env.NODE_ENV || 'development');

// Middleware
app.use(express.json());

// Analytics middleware
app.use(trackApiMetrics);
app.use(trackPageView);

// Apply rate limiting to routes
app.use('/api/auth', rateLimiter.auth(), authRouter);
app.use('/api/auth', rateLimiter.auth(), passwordResetRouter);
app.use('/api/auth', rateLimiter.auth(), emailVerificationRouter);
app.use('/api/auth', rateLimiter.auth(), sessionsRouter);
app.use('/api/auth', rateLimiter.auth(), accountRouter);
app.use('/api/auth', rateLimiter.auth(), twoFactorRouter);
app.use('/api/recipes', rateLimiter.api(), recipeRouter);
app.use('/api/recipes', rateLimiter.api(), reviewsRouter);
app.use('/api/prices', rateLimiter.api(), priceRouter);
app.use('/api/recipes', rateLimiter.api(), recipeVersionsRouter);
app.use('/api/recipes', rateLimiter.search(), recipeSearchRouter);
app.use('/api/reputation', rateLimiter.api(), reputationRouter);
app.use('/api/ingredients/custom', rateLimiter.api(), userIngredientsRouter);
app.use('/api/prices/scheduled', rateLimiter.api(), scheduledPricesRouter);
app.use('/api/recipes/featured', rateLimiter.api(), featuredRecipesRouter);
app.use('/api/admin/optimization', rateLimiter.admin(), queryOptimizationRouter);
app.use('/api/admin/audit', rateLimiter.admin(), auditLogsRouter);
app.use('/api/admin/analytics', rateLimiter.admin(), analyticsRouter);
app.use('/api/subscriptions', rateLimiter.api(), subscriptionsRouter);
app.use('/api/media', rateLimiter.api(), mediaRouter);
app.use('/api/admin/integrations', rateLimiter.admin(), integrationsRouter);
app.use('/api/users', rateLimiter.api(), usersRouter);
app.use('/api/feed', rateLimiter.api(), feedRouter);
app.use('/api/meal-plans', rateLimiter.api(), mealPlansRouter);
app.use('/api/moderation', rateLimiter.api(), moderationRouter);
app.use('/api/admin/moderation', rateLimiter.admin(), adminModerationRouter);
app.use('/api/users/preferences/notifications', rateLimiter.api(), notificationPreferencesRouter);
app.use('/api/users/devices', rateLimiter.api(), devicesRouter);
app.use('/api/users/localization', rateLimiter.api(), localizationRouter);
app.use('/api/users/compliance', rateLimiter.api(), complianceRouter);
app.use('/api/users/payments', rateLimiter.api(), paymentRouter);
app.use('/api/users/onboarding', rateLimiter.api(), onboardingRouter);
app.use('/api/admin/user-analytics', rateLimiter.admin(), userAnalyticsRouter);

// Add audit logging middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    // Log high-risk operations
    if (auditLogger.isHighRiskOperation(req.method, req.path)) {
      auditLogger.log(
        auditLogger.eventTypes.SECURITY.HIGH_RISK_OPERATION,
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userId: req.user?.id
        },
        {
          severity: auditLogger.severityLevels.WARNING,
          ipAddress: req.ip
        }
      ).catch(console.error); // Non-blocking
    }
    originalSend.call(this, data);
  };
  next();
});

app.get('/', (req, res) => {
    res.send('Rezapta API server is running');
});

// Error handling
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use(trackErrors);
app.use(errorHandler);

// Connect to database and start server
connectToDb()
    .then(async () => {
        // Setup database indexes
        await queryOptimizer.setupIndexes();
        
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
            console.log(`Environment: ${app.get('env')}`);
            // Start the price update scheduler
            scheduler.start();
        });
    })
    .catch((error) => {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting graceful shutdown...');
    await scheduler.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Starting graceful shutdown...');
    await scheduler.stop();
    process.exit(0);
});

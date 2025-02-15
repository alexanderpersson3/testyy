import recipeRoutes from './recipe/index.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import searchRoutes from './search.js';
import notificationRoutes from './notification.routes.js';
import collectionRoutes from './collections.js';
import shoppingListRoutes from './shopping-list.js';
import mealPlanRoutes from './meal-planning.js';
import socialRoutes from './social.js';
import analyticsRoutes from './analytics.routes.js';
import healthRoutes from './health.js';
import ingredientRoutes from './ingredients.js';
import userIngredientsRoutes from './user-ingredients.js';
/**
 * Setup all application routes
 */
export const setupRoutes = (app) => {
    // API Routes
    app.use('/api/recipes', recipeRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/search', searchRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/collections', collectionRoutes);
    app.use('/api/shopping-lists', shoppingListRoutes);
    app.use('/api/meal-plans', mealPlanRoutes);
    app.use('/api/social', socialRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/health', healthRoutes);
    app.use('/api/ingredients', ingredientRoutes);
    app.use('/api/user-ingredients', userIngredientsRoutes);
    // Basic health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });
};
//# sourceMappingURL=index.js.map
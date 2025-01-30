import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
export class OfflineStorageService {
    constructor(subscriptionManager, options = {}) {
        this.subscriptionManager = subscriptionManager;
        this.options = options;
        this.DEFAULT_MAX_ITEMS = 100;
        this.DEFAULT_EXPIRATION_DAYS = 30;
        this.options.maxItems = options.maxItems || this.DEFAULT_MAX_ITEMS;
        this.options.expirationDays = options.expirationDays || this.DEFAULT_EXPIRATION_DAYS;
    }
    async markRecipeForOffline(userId, recipeId) {
        try {
            const db = await getDb();
            const hasAccess = await this.verifyOfflineAccess(userId);
            if (!hasAccess) {
                throw new Error('Premium subscription required for offline access');
            }
            const offlineItem = {
                userId: new ObjectId(userId),
                recipeId: new ObjectId(recipeId),
                savedAt: new Date(),
                expiresAt: this.calculateExpirationDate(),
                syncStatus: 'pending'
            };
            await db.collection('offline_items').insertOne(offlineItem);
            return true;
        }
        catch (error) {
            console.error('Error marking recipe for offline:', error);
            throw error;
        }
    }
    async getOfflineRecipes(userId) {
        try {
            const db = await getDb();
            const offlineItems = await db.collection('offline_items')
                .find({
                userId: new ObjectId(userId),
                expiresAt: { $gt: new Date() }
            })
                .toArray();
            const recipeIds = offlineItems.map(item => item.recipeId);
            const recipes = await db.collection('recipes')
                .find({ _id: { $in: recipeIds } })
                .toArray();
            return recipes;
        }
        catch (error) {
            console.error('Error getting offline recipes:', error);
            throw error;
        }
    }
    async removeOfflineRecipe(userId, recipeId) {
        try {
            const db = await getDb();
            const result = await db.collection('offline_items').deleteOne({
                userId: new ObjectId(userId),
                recipeId: new ObjectId(recipeId)
            });
            return result.deletedCount > 0;
        }
        catch (error) {
            console.error('Error removing offline recipe:', error);
            throw error;
        }
    }
    async cleanupExpiredItems() {
        try {
            const db = await getDb();
            const result = await db.collection('offline_items').deleteMany({
                expiresAt: { $lt: new Date() }
            });
            return result.deletedCount;
        }
        catch (error) {
            console.error('Error cleaning up expired items:', error);
            throw error;
        }
    }
    async verifyOfflineAccess(userId) {
        try {
            return await this.subscriptionManager.hasFeatureAccess(userId, 'offline_access');
        }
        catch (error) {
            console.error('Error verifying offline access:', error);
            return false;
        }
    }
    calculateExpirationDate() {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + this.options.expirationDays);
        return expirationDate;
    }
}
//# sourceMappingURL=offline-storage.js.map
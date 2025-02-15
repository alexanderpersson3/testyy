import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db/database.service.js';
import logger from '../utils/logger.js';
export async function logCollectionActivity(collectionId, userId, type, details) {
    try {
        const db = await connectToDatabase();
        const activity = {
            collectionId,
            userId,
            type,
            details,
            createdAt: new Date(),
        };
        await db.collection('collection_activities').insertOne(activity);
        logger.debug('Collection activity logged:', { type, collectionId: collectionId.toString() });
    }
    catch (error) {
        logger.error('Failed to log collection activity:', error);
        throw error;
    }
}
export async function getCollectionActivities(collectionId, options = {}) {
    try {
        const db = await connectToDatabase();
        const query = {
            collectionId,
        };
        if (options.before) {
            query.createdAt = { $lt: options.before };
        }
        if (options.type?.length) {
            query.type = { $in: options.type };
        }
        return db
            .collection('collection_activities')
            .find(query)
            .sort({ createdAt: -1 })
            .limit(options.limit || 20)
            .toArray();
    }
    catch (error) {
        logger.error('Failed to get collection activities:', error);
        throw error;
    }
}
export function getCollectionActivityService() {
    return {
        logCollectionActivity,
        getCollectionActivities,
    };
}
//# sourceMappingURL=collection-activity.js.map
import { connectToDatabase } from '../db/db.js';
export async function logCollectionActivity(collectionId, userId, type, details) {
    const db = await connectToDatabase();
    const activity = {
        collectionId,
        userId,
        type,
        details,
        createdAt: new Date()
    };
    await db.collection('collection_activities').insertOne(activity);
}
export async function getCollectionActivities(collectionId, options = {}) {
    const db = await connectToDatabase();
    const query = { collectionId };
    if (options.before) {
        query.createdAt = { $lt: options.before };
    }
    if (options.type?.length) {
        query.type = { $in: options.type };
    }
    const activities = await db.collection('collection_activities')
        .aggregate([
        { $match: query },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        {
            $project: {
                type: 1,
                details: 1,
                createdAt: 1,
                user: {
                    _id: 1,
                    name: 1,
                    email: 1
                }
            }
        },
        { $sort: { createdAt: -1 } },
        ...(options.limit ? [{ $limit: options.limit }] : [])
    ])
        .toArray();
    return activities;
}
export function getCollectionActivityService() {
    return {
        logCollectionActivity,
        getCollectionActivities
    };
}
//# sourceMappingURL=collection-activity.js.map
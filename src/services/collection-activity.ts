import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db.js';

export interface CollectionActivity {
  _id: ObjectId;
  collectionId: ObjectId;
  userId: ObjectId;
  type: 'collection_created' | 'collection_updated' | 'recipe_added' | 'recipe_removed' | 
        'collaborator_added' | 'collaborator_removed' | 'collaborator_updated' |
        'collection_shared' | 'collection_unshared';
  details: {
    name?: string;
    description?: string;
    recipeId?: ObjectId;
    recipeTitle?: string;
    collaboratorId?: ObjectId;
    collaboratorEmail?: string;
    role?: 'viewer' | 'editor';
    changes?: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  };
  createdAt: Date;
}

export async function logCollectionActivity(
  collectionId: ObjectId,
  userId: ObjectId,
  type: CollectionActivity['type'],
  details: CollectionActivity['details']
) {
  const db = await connectToDatabase();

  const activity: Omit<CollectionActivity, '_id'> = {
    collectionId,
    userId,
    type,
    details,
    createdAt: new Date()
  };

  await db.collection<CollectionActivity>('collection_activities').insertOne(activity as CollectionActivity);
}

export async function getCollectionActivities(
  collectionId: ObjectId,
  options: {
    limit?: number;
    before?: Date;
    type?: CollectionActivity['type'][];
  } = {}
) {
  const db = await connectToDatabase();

  const query: any = { collectionId };
  if (options.before) {
    query.createdAt = { $lt: options.before };
  }
  if (options.type?.length) {
    query.type = { $in: options.type };
  }

  const activities = await db.collection<CollectionActivity>('collection_activities')
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
;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import type { getCollection } from '../types/express.js';
import { connectToDatabase } from '../db.js';;
import type { CreatorTip } from '../types/express.js';

export class CreatorTipService {
  private static instance: CreatorTipService;

  private constructor() {}

  static getInstance(): CreatorTipService {
    if (!CreatorTipService.instance) {
      CreatorTipService.instance = new CreatorTipService();
    }
    return CreatorTipService.instance;
  }

  async createTip(userId: ObjectId, content: string): Promise<CreatorTip> {
    await connectToDatabase();

    const tip: Omit<CreatorTip, '_id'> = {
      userId,
      content,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getCollection<CreatorTip>('creator_tips').insertOne(tip as CreatorTip);
    return {
      ...tip,
      _id: result.insertedId,
    };
  }

  async getTip(tipId: ObjectId): Promise<CreatorTip | null> {
    await connectToDatabase();
    return getCollection<CreatorTip>('creator_tips').findOne({ _id: tipId });
  }

  async getUserTips(userId: ObjectId): Promise<CreatorTip[]> {
    await connectToDatabase();
    return getCollection<CreatorTip>('creator_tips')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async updateTip(tipId: ObjectId, userId: ObjectId, content: string): Promise<boolean> {
    await connectToDatabase();

    const result = await getCollection<CreatorTip>('creator_tips').updateOne(
      { _id: tipId, userId },
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  async deleteTip(tipId: ObjectId, userId: ObjectId): Promise<boolean> {
    await connectToDatabase();

    const result = await getCollection<CreatorTip>('creator_tips').deleteOne({
      _id: tipId,
      userId,
    });

    return result.deletedCount > 0;
  }
}

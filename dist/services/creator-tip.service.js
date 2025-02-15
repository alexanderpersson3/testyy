import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
export class CreatorTipService {
    constructor() { }
    static getInstance() {
        if (!CreatorTipService.instance) {
            CreatorTipService.instance = new CreatorTipService();
        }
        return CreatorTipService.instance;
    }
    async createTip(userId, content) {
        await connectToDatabase();
        const tip = {
            userId,
            content,
            likes: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await getCollection('creator_tips').insertOne(tip);
        return {
            ...tip,
            _id: result.insertedId,
        };
    }
    async getTip(tipId) {
        await connectToDatabase();
        return getCollection('creator_tips').findOne({ _id: tipId });
    }
    async getUserTips(userId) {
        await connectToDatabase();
        return getCollection('creator_tips')
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    async updateTip(tipId, userId, content) {
        await connectToDatabase();
        const result = await getCollection('creator_tips').updateOne({ _id: tipId, userId }, {
            $set: {
                content,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    async deleteTip(tipId, userId) {
        await connectToDatabase();
        const result = await getCollection('creator_tips').deleteOne({
            _id: tipId,
            userId,
        });
        return result.deletedCount > 0;
    }
}
//# sourceMappingURL=creator-tip.service.js.map
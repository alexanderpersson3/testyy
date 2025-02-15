import { Db } from 'mongodb';
import { ModerationQueueItem, ModerationNote, ModeratorStats, moderationPrioritySchema, moderationActionSchema, } from '../schemas/moderationSchemas.js';
export class ModerationService {
    constructor(db) {
        this.db = db;
        this.moderationQueue = this.db.collection('moderationQueue');
        this.moderationNotes = this.db.collection('moderationNotes');
        this.recipes = this.db.collection('recipes');
    }
    async getQueuedRecipes(options) {
        const query = {};
        if (options.status)
            query.status = { $in: options.status };
        if (options.priority)
            query.priority = { $in: options.priority };
        const queueItems = await this.moderationQueue
            .find(query)
            .skip(options.offset || 0)
            .limit(options.limit || 10)
            .toArray();
        // Fetch recipe details for each queue item
        const recipes = await Promise.all(queueItems.map(async (item) => {
            const recipe = await this.recipes.findOne({ _id: item.recipeId });
            return {
                ...item,
                recipe,
            };
        }));
        return recipes;
    }
    async addToQueue(recipeId, priority = 'low') {
        const now = new Date();
        const queueItem = {
            _id: new ObjectId().toString(),
            recipeId: recipeId.toString(),
            status: 'pending',
            submittedAt: now,
            priority,
            notes: [],
            createdAt: now,
            updatedAt: now,
        };
        await this.moderationQueue.insertOne(queueItem);
        return queueItem;
    }
    async reviewRecipe(recipeId, adminId, action, note) {
        const now = new Date();
        const moderationNote = {
            _id: new ObjectId().toString(),
            recipeId: recipeId.toString(),
            adminId: adminId.toString(),
            note,
            action,
            createdAt: now,
        };
        await this.moderationNotes.insertOne(moderationNote);
        // Update recipe status
        await this.recipes.updateOne({ _id: recipeId }, {
            $set: {
                status: action === 'approve'
                    ? 'approved'
                    : action === 'reject'
                        ? 'rejected'
                        : 'changes_requested',
                updatedAt: now,
            },
        });
        // Update queue item
        await this.moderationQueue.updateOne({ recipeId: recipeId.toString() }, {
            $set: {
                status: action === 'approve'
                    ? 'approved'
                    : action === 'reject'
                        ? 'rejected'
                        : 'changes_requested',
                reviewedAt: now,
                reviewedBy: adminId.toString(),
                updatedAt: now,
            },
            $push: {
                notes: moderationNote,
            },
        });
    }
    async getModerationHistory(recipeId) {
        return this.moderationNotes
            .find({ recipeId: recipeId.toString() })
            .sort({ createdAt: -1 })
            .toArray();
    }
    async getModeratorStats(adminId, startDate, endDate) {
        const notes = await this.moderationNotes
            .find({
            adminId: adminId.toString(),
            createdAt: {
                $gte: startDate,
                $lte: endDate,
            },
        })
            .toArray();
        const stats = {
            totalReviewed: notes.length,
            approved: notes.filter((n) => n.action === 'approve').length,
            rejected: notes.filter((n) => n.action === 'reject').length,
            changesRequested: notes.filter((n) => n.action === 'request_changes').length,
            averageResponseTime: 0,
        };
        // Calculate average response time
        if (notes.length > 0) {
            const totalResponseTime = await this.calculateTotalResponseTime(notes);
            stats.averageResponseTime = totalResponseTime / notes.length;
        }
        return stats;
    }
    async calculateTotalResponseTime(notes) {
        let totalTime = 0;
        for (const note of notes) {
            const queueItem = await this.moderationQueue.findOne({
                recipeId: note.recipeId,
                notes: { $elemMatch: { _id: note._id } },
            });
            if (queueItem) {
                const submissionTime = queueItem.submittedAt.getTime();
                const reviewTime = note.createdAt.getTime();
                totalTime += (reviewTime - submissionTime) / (1000 * 60); // Convert to minutes
            }
        }
        return totalTime;
    }
}
//# sourceMappingURL=moderationService.js.map
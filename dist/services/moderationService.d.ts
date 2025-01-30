import { Db, ObjectId } from 'mongodb';
import { ModerationQueueItem, ModerationNote, ModeratorStats, QueuedRecipe } from '../schemas/moderationSchemas';
type ModerationPriority = 'low' | 'medium' | 'high';
type ModerationAction = 'approve' | 'reject' | 'request_changes';
export declare class ModerationService {
    private db;
    private moderationQueue;
    private moderationNotes;
    private recipes;
    constructor(db: Db);
    getQueuedRecipes(options: {
        status?: string[];
        priority?: ModerationPriority[];
        limit?: number;
        offset?: number;
    }): Promise<QueuedRecipe[]>;
    addToQueue(recipeId: ObjectId, priority?: ModerationPriority): Promise<ModerationQueueItem>;
    reviewRecipe(recipeId: ObjectId, adminId: ObjectId, action: ModerationAction, note: string): Promise<void>;
    getModerationHistory(recipeId: ObjectId): Promise<ModerationNote[]>;
    getModeratorStats(adminId: ObjectId, startDate: Date, endDate: Date): Promise<ModeratorStats>;
    private calculateTotalResponseTime;
}
export {};
//# sourceMappingURL=moderationService.d.ts.map
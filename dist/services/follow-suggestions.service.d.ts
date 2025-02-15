import { DatabaseService } from '../db/database.service.js';
export declare class FollowSuggestionsService {
    private db;
    constructor(db: DatabaseService);
    getFollowSuggestions(userId: ObjectId): Promise<Array<{
        userId: ObjectId;
        score: number;
    }>>;
}

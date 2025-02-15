import { ObjectId } from 'mongodb';
import type { CreatorTip } from '../types/index.js';
export declare class CreatorTipService {
    private static instance;
    private constructor();
    static getInstance(): CreatorTipService;
    createTip(userId: ObjectId, content: string): Promise<CreatorTip>;
    getTip(tipId: ObjectId): Promise<CreatorTip | null>;
    getUserTips(userId: ObjectId): Promise<CreatorTip[]>;
    updateTip(tipId: ObjectId, userId: ObjectId, content: string): Promise<boolean>;
    deleteTip(tipId: ObjectId, userId: ObjectId): Promise<boolean>;
}

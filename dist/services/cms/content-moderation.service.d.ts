import { ObjectId } from 'mongodb';
interface ContentModerationResult {
    isApproved: boolean;
    reasons: string[];
    score: number;
    flags: {
        profanity: boolean;
        spam: boolean;
        offensive: boolean;
        inappropriate: boolean;
    };
}
interface ModerationRule {
    _id?: ObjectId;
    type: 'keyword' | 'regex' | 'score';
    pattern: string | RegExp;
    score: number;
    category: 'profanity' | 'spam' | 'offensive' | 'inappropriate';
}
export declare class ContentModerationService {
    private static instance;
    private db;
    private rules;
    private constructor();
    static getInstance(): ContentModerationService;
    /**
     * Load moderation rules from database
     */
    private loadRules;
    /**
     * Add a new moderation rule
     */
    addRule(rule: Omit<ModerationRule, '_id'>): Promise<ModerationRule>;
    /**
     * Remove a moderation rule
     */
    removeRule(ruleId: ObjectId): Promise<void>;
    /**
     * Moderate content
     */
    moderateContent(content: string): Promise<ContentModerationResult>;
    /**
     * Apply a single moderation rule
     */
    private applyRule;
    /**
     * Get moderation rules
     */
    getRules(): Promise<ModerationRule[]>;
    /**
     * Update a moderation rule
     */
    updateRule(ruleId: ObjectId, updates: Partial<ModerationRule>): Promise<ModerationRule>;
    /**
     * Moderate recipe content
     */
    moderateRecipe(recipe: {
        title: string;
        description: string;
        instructions: string[];
    }): Promise<ContentModerationResult>;
    /**
     * Moderate comment content
     */
    moderateComment(comment: string): Promise<ContentModerationResult>;
}
export {};

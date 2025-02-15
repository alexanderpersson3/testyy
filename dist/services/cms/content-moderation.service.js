import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../../db/database.service.js';
import logger from '../../utils/logger.js';
import { DatabaseError } from '../../utils/errors.js';
export class ContentModerationService {
    constructor() {
        this.rules = [];
        this.db = DatabaseService.getInstance();
        this.loadRules().catch(error => {
            logger.error('Failed to load moderation rules:', error);
        });
    }
    static getInstance() {
        if (!ContentModerationService.instance) {
            ContentModerationService.instance = new ContentModerationService();
        }
        return ContentModerationService.instance;
    }
    /**
     * Load moderation rules from database
     */
    async loadRules() {
        try {
            this.rules = await this.db
                .getCollection('moderation_rules')
                .find()
                .toArray();
        }
        catch (error) {
            logger.error('Failed to load moderation rules:', error);
            throw new DatabaseError('Failed to load moderation rules');
        }
    }
    /**
     * Add a new moderation rule
     */
    async addRule(rule) {
        try {
            const result = await this.db
                .getCollection('moderation_rules')
                .insertOne(rule);
            const newRule = { ...rule, _id: result.insertedId };
            this.rules.push(newRule);
            return newRule;
        }
        catch (error) {
            logger.error('Failed to add moderation rule:', error);
            throw new DatabaseError('Failed to add moderation rule');
        }
    }
    /**
     * Remove a moderation rule
     */
    async removeRule(ruleId) {
        try {
            await this.db
                .getCollection('moderation_rules')
                .deleteOne({ _id: ruleId });
            this.rules = this.rules.filter(rule => rule._id !== ruleId);
        }
        catch (error) {
            logger.error('Failed to remove moderation rule:', error);
            throw new DatabaseError('Failed to remove moderation rule');
        }
    }
    /**
     * Moderate content
     */
    async moderateContent(content) {
        const result = {
            isApproved: true,
            reasons: [],
            score: 0,
            flags: {
                profanity: false,
                spam: false,
                offensive: false,
                inappropriate: false,
            },
        };
        // Apply each rule
        for (const rule of this.rules) {
            const matches = this.applyRule(rule, content);
            if (matches) {
                result.score += rule.score;
                result.flags[rule.category] = true;
                result.reasons.push(`Matched ${rule.category} rule: ${rule.pattern}`);
            }
        }
        // Determine if content should be approved
        result.isApproved = result.score < 10 && !Object.values(result.flags).some(flag => flag);
        return result;
    }
    /**
     * Apply a single moderation rule
     */
    applyRule(rule, content) {
        switch (rule.type) {
            case 'keyword':
                return content.toLowerCase().includes(rule.pattern.toLowerCase());
            case 'regex':
                return rule.pattern.test(content);
            case 'score':
                // Implement more sophisticated scoring logic here
                return false;
            default:
                return false;
        }
    }
    /**
     * Get moderation rules
     */
    async getRules() {
        return this.rules;
    }
    /**
     * Update a moderation rule
     */
    async updateRule(ruleId, updates) {
        try {
            const result = await this.db
                .getCollection('moderation_rules')
                .findOneAndUpdate({ _id: ruleId }, { $set: updates }, { returnDocument: 'after' });
            if (!result.value) {
                throw new Error('Rule not found');
            }
            // Update local rules
            const index = this.rules.findIndex(rule => rule._id === ruleId);
            if (index !== -1) {
                this.rules[index] = result.value;
            }
            return result.value;
        }
        catch (error) {
            logger.error('Failed to update moderation rule:', error);
            throw new DatabaseError('Failed to update moderation rule');
        }
    }
    /**
     * Moderate recipe content
     */
    async moderateRecipe(recipe) {
        // Combine all text content for moderation
        const content = [
            recipe.title,
            recipe.description,
            ...recipe.instructions,
        ].join('\n');
        return this.moderateContent(content);
    }
    /**
     * Moderate comment content
     */
    async moderateComment(comment) {
        return this.moderateContent(comment);
    }
}
ContentModerationService.instance = null;
//# sourceMappingURL=content-moderation.service.js.map
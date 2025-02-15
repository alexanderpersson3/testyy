import { ObjectId } from 'mongodb';
;
import { hasId } from '../utils/mongodb-utils.js';
/**
 * Type guard to check if a value is a valid MongoDB Filter
 */
export function isValidFilter(value) {
    if (!value || typeof value !== 'object')
        return false;
    // Check for common MongoDB operators
    const obj = value;
    for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
            // Check for valid MongoDB operators
            const operators = Object.keys(val).filter((op) => typeof op === 'string');
            const validOperators = ['$in', '$nin', '$exists', '$ne', '$gt', '$gte', '$lt', '$lte',
                '$regex', '$elemMatch', '$size', '$all', '$not', '$text'];
            if (!operators.every(op => validOperators.includes(op))) {
                return false;
            }
        }
    }
    return true;
}
/**
 * Type guard to check if a value is a valid MongoDB UpdateOperation
 */
export function isValidUpdate(value) {
    if (!value || typeof value !== 'object')
        return false;
    const update = value;
    const validOperators = ['$set', '$push', '$pull', '$inc', '$unset', '$min', '$max',
        '$mul', '$rename', '$currentDate'];
    // Check that all top-level keys are valid MongoDB update operators
    return Object.keys(update).every(key => validOperators.includes(key));
}
/**
 * Type guard to check if a value is a valid MongoDB AggregationStage
 */
export function isValidAggregationStage(value) {
    if (!value || typeof value !== 'object')
        return false;
    const stage = value;
    const validStages = ['$match', '$sort', '$limit', '$skip', '$project', '$lookup',
        '$group', '$unwind', '$facet'];
    // Check that the stage has exactly one valid MongoDB aggregation operator
    const [firstKey] = Object.keys(stage);
    return typeof firstKey === 'string' && validStages.includes(firstKey);
}
/**
 * Type guard to check if a value is a valid MongoDB Sort operation
 */
export function isValidSort(value) {
    if (!value || typeof value !== 'object')
        return false;
    const sort = value;
    return Object.values(sort).every(val => val === 1 || val === -1);
}
/**
 * Validation utility for MongoDB operations
 */
export const MongoValidation = {
    /**
     * Validates a filter and throws if invalid
     */
    validateFilter(filter) {
        if (!isValidFilter(filter)) {
            throw new Error('Invalid MongoDB filter');
        }
    },
    /**
     * Validates an update operation and throws if invalid
     */
    validateUpdate(update) {
        if (!isValidUpdate(update)) {
            throw new Error('Invalid MongoDB update operation');
        }
    },
    /**
     * Validates an aggregation stage and throws if invalid
     */
    validateAggregationStage(stage) {
        if (!isValidAggregationStage(stage)) {
            throw new Error('Invalid MongoDB aggregation stage');
        }
    },
    /**
     * Validates a sort operation and throws if invalid
     */
    validateSort(sort) {
        if (!isValidSort(sort)) {
            throw new Error('Invalid MongoDB sort operation');
        }
    }
};
//# sourceMappingURL=mongodb.js.map
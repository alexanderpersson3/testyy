import { ValidationError } from '../types/errors.js';
/**
 * Validates that a property is a valid ObjectId
 */
export function IsObjectId() {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            if (!(newVal instanceof ObjectId)) {
                throw new ValidationError(`${propertyKey} must be an ObjectId`);
            }
            value = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Validates that a property is a valid date
 */
export function IsDate() {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            if (!(newVal instanceof Date) || isNaN(newVal.getTime())) {
                throw new ValidationError(`${propertyKey} must be a valid Date`);
            }
            value = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Validates that a property is a non-empty string
 */
export function IsNonEmptyString() {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            if (typeof newVal !== 'string' || newVal.trim().length === 0) {
                throw new ValidationError(`${propertyKey} must be a non-empty string`);
            }
            value = newVal.trim();
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Validates that a property is a valid number within a range
 */
export function IsNumber(min, max) {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            if (typeof newVal !== 'number' || isNaN(newVal)) {
                throw new ValidationError(`${propertyKey} must be a valid number`);
            }
            if (min !== undefined && newVal < min) {
                throw new ValidationError(`${propertyKey} must be greater than or equal to ${min}`);
            }
            if (max !== undefined && newVal > max) {
                throw new ValidationError(`${propertyKey} must be less than or equal to ${max}`);
            }
            value = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Validates that a property is a valid enum value
 */
export function IsEnum(enumType) {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            const validValues = Object.values(enumType);
            if (!validValues.includes(newVal)) {
                throw new ValidationError(`${propertyKey} must be one of: ${validValues.join(', ')}`);
            }
            value = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Validates that a property is a valid boolean
 */
export function IsBoolean() {
    return function (target, propertyKey) {
        let value;
        const getter = function () {
            return value;
        };
        const setter = function (newVal) {
            if (typeof newVal !== 'boolean') {
                throw new ValidationError(`${propertyKey} must be a boolean`);
            }
            value = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true,
        });
    };
}
//# sourceMappingURL=validation.js.map
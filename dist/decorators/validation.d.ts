/**
 * Validates that a property is a valid ObjectId
 */
export declare function IsObjectId(): (target: any, propertyKey: string) => void;
/**
 * Validates that a property is a valid date
 */
export declare function IsDate(): (target: any, propertyKey: string) => void;
/**
 * Validates that a property is a non-empty string
 */
export declare function IsNonEmptyString(): (target: any, propertyKey: string) => void;
/**
 * Validates that a property is a valid number within a range
 */
export declare function IsNumber(min?: number, max?: number): (target: any, propertyKey: string) => void;
/**
 * Validates that a property is a valid enum value
 */
export declare function IsEnum(enumType: object): (target: any, propertyKey: string) => void;
/**
 * Validates that a property is a valid boolean
 */
export declare function IsBoolean(): (target: any, propertyKey: string) => void;

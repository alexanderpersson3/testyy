import { MongoClientOptions, ModifyResult } from 'mongodb';
/**
 * Type for database error
 */
export class DatabaseError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'DatabaseError';
    }
}
//# sourceMappingURL=database.js.map
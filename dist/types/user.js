import { ObjectId } from 'mongodb';
;
import { UserRole } from '../auth.js';
import { Subscription } from '../subscription.js';
// Type guards
export const isAdmin = (user) => user.role === UserRole.ADMIN;
export const isPremium = (user) => user.role === UserRole.PREMIUM || user.role === UserRole.ADMIN;
// Re-export auth types
export { UserRole };
//# sourceMappingURL=user.js.map
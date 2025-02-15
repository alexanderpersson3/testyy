import { ObjectId } from 'mongodb';
;
export var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["MODERATOR"] = "moderator";
    UserRole["PREMIUM"] = "premium";
})(UserRole || (UserRole = {}));
// Helper functions
export function convertToObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
export function convertToString(id) {
    return typeof id === 'string' ? id : id.toString();
}
// Type guards
export function isAuthenticatedRequest(req) {
    return req.user !== undefined && 'id' in req.user;
}
//# sourceMappingURL=auth.js.map
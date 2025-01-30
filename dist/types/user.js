export var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["PREMIUM"] = "premium";
    UserRole["ADMIN"] = "admin";
})(UserRole || (UserRole = {}));
// Type guard for checking if a user has admin role
export const isAdmin = (user) => user.role === UserRole.ADMIN;
// Type guard for checking if a user has premium role
export const isPremium = (user) => user.role === UserRole.PREMIUM || user.role === UserRole.ADMIN;
//# sourceMappingURL=user.js.map
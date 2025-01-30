import { UserProfile, UserRole, AuthUser } from '../types/user';
declare class UserManager {
    private static instance;
    private constructor();
    static getInstance(): UserManager;
    getUserById(userId: string): Promise<UserProfile | null>;
    isAdmin(userId: string): Promise<boolean>;
    createUser(email: string): Promise<string | null>;
    updateUserRole(userId: string, role: UserRole): Promise<boolean>;
    getAuthUser(userId: string): Promise<AuthUser | null>;
}
declare const _default: UserManager;
export default _default;
//# sourceMappingURL=user-manager.d.ts.map
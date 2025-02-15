import { UserProfile, UserRole, AuthUser } from '../types/user.js';
export declare class UserManager {
    private collection;
    constructor();
    private initializeCollection;
    getUserById(userId: string): Promise<UserProfile | null>;
    createUser(userData: Omit<UserProfile, '_id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile>;
    updateUser(userId: string, updates: Partial<Omit<UserProfile, '_id' | 'createdAt'>>): Promise<void>;
    isAdmin(userId: string): Promise<boolean>;
    updateUserRole(userId: string, role: UserRole): Promise<boolean>;
    getAuthUser(userId: string): Promise<AuthUser | null>;
    private createAuthUser;
}
export declare const userManager: UserManager;

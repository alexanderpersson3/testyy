import { ObjectId } from 'mongodb';
export declare enum UserRole {
    USER = "user",
    PREMIUM = "premium",
    ADMIN = "admin"
}
export interface UserProfile {
    _id: ObjectId;
    email: string;
    role: UserRole;
    features: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
}
export declare const isAdmin: (user: AuthUser) => boolean;
export declare const isPremium: (user: AuthUser) => boolean;
export interface User {
    _id?: ObjectId;
    email: string;
    name: string;
    password: string;
    role: 'user' | 'admin' | 'moderator';
    isVerified: boolean;
    isPro: boolean;
    invitedBy?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    profile?: {
        bio?: string;
        instagramLink?: string;
        facebookLink?: string;
        website?: string;
        highlights?: string[];
    };
    settings?: {
        notifications: {
            email: boolean;
            push: boolean;
            sharedListUpdates: boolean;
            newFollowers: boolean;
            newComments: boolean;
            weeklyDigest: boolean;
        };
        display: {
            theme: 'light' | 'dark' | 'system';
            language: string;
            timezone: string;
        };
    };
}
//# sourceMappingURL=user.d.ts.map
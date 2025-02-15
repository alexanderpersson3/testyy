import { ObjectId } from 'mongodb';
export type ShareChannel = 'link' | 'email' | 'facebook' | 'twitter' | 'pinterest' | 'whatsapp' | 'telegram' | 'embed';
export type SharePermission = 'view' | 'comment' | 'rate' | 'fork';
export interface BaseShare {
    recipeId: ObjectId;
    userId: ObjectId;
    channel: ShareChannel;
    permission: SharePermission;
    token: string;
    isActive: boolean;
    expiresAt?: Date;
    maxUses?: number;
    useCount: number;
    password?: string;
    allowedEmails?: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Share extends BaseShare {
    _id?: ObjectId;
}
export interface ShareDocument extends BaseShare {
    _id: ObjectId;
}
export interface ShareWithDetails extends ShareDocument {
    recipe?: {
        _id: ObjectId;
        name: string;
        imageUrl?: string;
        description?: string;
    };
    user?: {
        _id: ObjectId;
        username: string;
        avatar?: string;
    };
}
export interface CreateShareDTO {
    channel: ShareChannel;
    permission: SharePermission;
    expiresAt?: Date;
    maxUses?: number;
    password?: string;
    allowedEmails?: string[];
}
export interface UpdateShareDTO {
    permission?: SharePermission;
    isActive?: boolean;
    expiresAt?: Date;
    maxUses?: number;
    password?: string;
    allowedEmails?: string[];
}
export interface ShareQuery {
    recipeId?: string;
    userId?: string;
    channel?: ShareChannel;
    isActive?: boolean;
    search?: string;
}
export interface ShareStats {
    totalShares: number;
    activeShares: number;
    totalUses: number;
    channelStats: {
        [key in ShareChannel]: {
            shares: number;
            uses: number;
        };
    };
}
export interface ShareAccess {
    token: string;
    password?: string;
    email?: string;
}
export interface ShareResult {
    success: boolean;
    share?: ShareWithDetails;
    url?: string;
    embedCode?: string;
    error?: {
        code: 'expired' | 'inactive' | 'max_uses' | 'invalid_password' | 'invalid_email' | 'not_found';
        message: string;
    };
}
export interface ShareMetrics {
    views: number;
    uniqueVisitors: number;
    shares: number;
    engagement: {
        comments: number;
        ratings: number;
        forks: number;
    };
    referrers: {
        [key: string]: number;
    };
}
export interface EmbedOptions {
    width?: string;
    height?: string;
    theme?: 'light' | 'dark';
    showImage?: boolean;
    showDescription?: boolean;
    showIngredients?: boolean;
    showInstructions?: boolean;
    showMetadata?: boolean;
    responsive?: boolean;
}

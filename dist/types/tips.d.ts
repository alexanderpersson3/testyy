import { ObjectId } from 'mongodb';
/**
 * Tip types
 */
export type TipType = 'ingredient' | 'technique' | 'equipment' | 'timing' | 'storage' | 'serving' | 'general';
/**
 * Tip visibility
 */
export type TipVisibility = 'public' | 'private' | 'followers';
/**
 * Tip category
 */
export type TipCategory = 'cooking' | 'ingredient' | 'equipment' | 'technique' | 'storage' | 'other';
/**
 * Tip status
 */
export type TipStatus = 'pending' | 'approved' | 'rejected';
/**
 * Recipe tip
 */
export interface RecipeTip {
    _id?: ObjectId;
    recipeId: ObjectId;
    userId: ObjectId;
    category: TipCategory;
    content: string;
    status: TipStatus;
    votes: {
        helpful: number;
        notHelpful: number;
    };
    flags?: TipFlag[];
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Recipe note
 */
export interface RecipeNote {
    _id?: ObjectId;
    recipeId: ObjectId;
    userId: ObjectId;
    content: string;
    category?: string;
    tags?: string[];
    position?: {
        step?: number;
        ingredient?: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
        caption?: string;
    }[];
    reminderAt?: Date;
    isImportant: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Tip creation request
 */
export interface CreateTipRequest {
    recipeId: string;
    type: TipType;
    content: string;
    visibility: TipVisibility;
    position?: {
        step?: number;
        ingredient?: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
        caption?: string;
    }[];
}
/**
 * Tip update request
 */
export interface UpdateTipRequest {
    type?: TipType;
    content?: string;
    visibility?: TipVisibility;
    position?: {
        step?: number;
        ingredient?: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
        caption?: string;
    }[];
}
/**
 * Note creation request
 */
export interface CreateNoteRequest {
    recipeId: string;
    content: string;
    category?: string;
    tags?: string[];
    position?: {
        step?: number;
        ingredient?: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
        caption?: string;
    }[];
    reminderAt?: Date;
    isImportant?: boolean;
}
/**
 * Note update request
 */
export interface UpdateNoteRequest {
    content?: string;
    category?: string;
    tags?: string[];
    position?: {
        step?: number;
        ingredient?: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
        caption?: string;
    }[];
    reminderAt?: Date;
    isImportant?: boolean;
}
/**
 * Tip filters
 */
export interface TipFilters {
    types?: TipType[];
    visibility?: TipVisibility[];
    status?: ('pending' | 'approved' | 'rejected')[];
    userId?: string;
    hasAttachments?: boolean;
    minVotes?: number;
    search?: string;
}
/**
 * Note filters
 */
export interface NoteFilters {
    categories?: string[];
    tags?: string[];
    hasAttachments?: boolean;
    hasReminder?: boolean;
    isImportant?: boolean;
    search?: string;
}
/**
 * Tip vote
 */
export interface TipVote {
    _id?: ObjectId;
    userId: ObjectId;
    tipId: ObjectId;
    isHelpful: boolean;
    createdAt: Date;
}
/**
 * Tip flag
 */
export interface TipFlag {
    userId: ObjectId;
    reason: string;
    createdAt: Date;
}
/**
 * Tip report
 */
export interface TipReport {
    _id?: ObjectId;
    userId: ObjectId;
    tipId: ObjectId;
    reason: string;
    status: 'pending' | 'reviewed' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Tip stats
 */
export interface TipStats {
    tipId?: ObjectId;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    totalVotes: number;
    views: number;
    uniqueViews: number;
    upvotes: number;
    downvotes: number;
    byCategory?: Record<string, number>;
    byUser?: Record<string, number>;
}
/**
 * Note reminder
 */
export interface NoteReminder {
    _id?: ObjectId;
    noteId: ObjectId;
    userId: ObjectId;
    tipId: ObjectId;
    reminderDate: Date;
    message: string;
    status: 'pending' | 'sent' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
    recipeId: ObjectId;
    content: string;
}

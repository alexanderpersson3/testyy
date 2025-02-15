import { ObjectId } from 'mongodb';
import type { BaseDocument, UpdateDocument } from '../types/index.js';
export type ChallengeType = 'weekly' | 'monthly' | 'special';
export type ChallengeStatus = 'active' | 'completed' | 'cancelled';
/**
 * Base Challenge interface without MongoDB-specific fields
 */
export interface ChallengeBase {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    status: ChallengeStatus;
    type: ChallengeType;
    rules: string[];
    rewards: string[];
    participants: string[];
    createdBy: string;
}
/**
 * Challenge document as stored in MongoDB
 */
export interface Challenge extends ChallengeBase, BaseDocument {
}
/**
 * DTO for creating a new challenge
 * Note: status, participants, and createdBy are added by the service
 */
export interface CreateChallengeDto {
    title: string;
    description: string;
    type: ChallengeType;
    startDate: Date;
    endDate: Date;
    rules: string[];
    rewards: string[];
}
/**
 * DTO for updating a challenge
 */
export interface UpdateChallengeDto extends UpdateDocument<ChallengeBase> {
    title?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    rules?: string[];
    rewards?: string[];
    status?: ChallengeStatus;
}
/**
 * Base Submission interface without MongoDB-specific fields
 */
export interface ChallengeSubmissionBase {
    challengeId: string;
    userId: string;
    content: string;
    mediaUrls?: string[];
    status: 'pending' | 'approved' | 'rejected';
}
/**
 * Submission document as stored in MongoDB
 */
export interface ChallengeSubmission extends ChallengeSubmissionBase, BaseDocument {
}
/**
 * DTO for creating a new submission
 * Note: status, challengeId, and userId are added by the service
 */
export interface CreateSubmissionDto {
    content: string;
    mediaUrls?: string[];
}
/**
 * Challenge with user progress information
 */
export interface ChallengeWithProgress extends Challenge {
    userProgress?: UserChallengeProgress;
    topParticipants?: {
        userId: ObjectId;
        name: string;
        avatar?: string;
        progress: number;
        rank: number;
    }[];
}
/**
 * User's progress in a challenge
 */
export interface UserChallengeProgress extends BaseDocument {
    userId: ObjectId;
    challengeId: ObjectId;
    progress: number;
    completedSessions: ObjectId[];
    currentStreak: number;
    bestStreak: number;
    lastUpdated: Date;
    joinedAt: Date;
    completedAt?: Date;
    rank?: number;
}
/**
 * Challenge query parameters
 */
export interface ChallengeQueryParams {
    status?: ChallengeStatus;
    type?: ChallengeType;
    limit?: number;
    offset?: number;
    includeProgress?: boolean;
    includeLeaderboard?: boolean;
}
/**
 * Challenge statistics
 */
export interface ChallengeStats {
    totalParticipants: number;
    totalSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    pendingSubmissions: number;
    startDate: Date;
    endDate: Date;
    daysRemaining: number;
    isActive: boolean;
}

import { ObjectId } from 'mongodb';
export type ChallengeType = 'count' | 'streak' | 'achievement';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export interface Challenge {
    _id?: ObjectId;
    name: string;
    description: string;
    type: ChallengeType;
    startDate: Date;
    endDate: Date;
    targetGoal: number;
    rules: string[];
    rewards?: {
        type: string;
        value: any;
    }[];
    status: ChallengeStatus;
    participantCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserChallengeProgress {
    _id?: ObjectId;
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
export interface CreateChallengeDto {
    name: string;
    description: string;
    type: ChallengeType;
    startDate: Date;
    endDate: Date;
    targetGoal: number;
    rules: string[];
    rewards?: {
        type: string;
        value: any;
    }[];
}
export interface UpdateChallengeDto {
    name?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    targetGoal?: number;
    rules?: string[];
    rewards?: {
        type: string;
        value: any;
    }[];
    status?: ChallengeStatus;
}
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
export interface LeaderboardEntry {
    userId: ObjectId;
    name: string;
    avatar?: string;
    progress: number;
    rank: number;
    currentStreak: number;
    bestStreak: number;
}
export interface ChallengeQueryParams {
    status?: ChallengeStatus;
    type?: ChallengeType;
    limit?: number;
    offset?: number;
    includeProgress?: boolean;
    includeLeaderboard?: boolean;
}
//# sourceMappingURL=challenge.d.ts.map
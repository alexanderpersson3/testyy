import { ObjectId } from 'mongodb';
export type Visibility = 'public' | 'followers' | 'private';
export interface StepProgress {
    stepIndex: number;
    isCompleted: boolean;
    startedAt?: Date;
    completedAt?: Date;
    notes?: string;
}
export interface TimerProgress {
    stepIndex: number;
    timerId: string;
    startedAt: Date;
    pausedAt?: Date;
    completedAt?: Date;
    remainingSeconds: number;
}
export type CookingSessionStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';
export interface CookingSessionParticipant {
    userId: ObjectId;
    role: 'host' | 'participant';
    joinedAt: Date;
    currentStep?: number;
    completedSteps: number[];
}
export interface CookingSessionPhoto {
    _id: ObjectId;
    userId: ObjectId;
    imageUrl: string;
    caption?: string;
    stepNumber?: number;
    createdAt: Date;
}
export interface CookingSessionComment {
    _id: ObjectId;
    userId: ObjectId;
    content: string;
    stepNumber?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CookingSession {
    _id?: ObjectId;
    recipeId: ObjectId;
    status: CookingSessionStatus;
    participants: CookingSessionParticipant[];
    photos: CookingSessionPhoto[];
    comments: CookingSessionComment[];
    startTime?: Date;
    endTime?: Date;
    scheduledFor?: Date;
    maxParticipants?: number;
    isPrivate: boolean;
    orientation: 'vertical' | 'horizontal';
    servings: number;
    stepProgress: StepProgress[];
    activeTimers: TimerProgress[];
    createdAt: Date;
    updatedAt: Date;
}
export interface CookingSessionInvite {
    _id?: ObjectId;
    sessionId: ObjectId;
    invitedBy: ObjectId;
    email: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Date;
    expiresAt: Date;
    acceptedAt?: Date;
}
export interface CookingSessionLike {
    _id?: ObjectId;
    sessionId: ObjectId;
    userId: ObjectId;
    createdAt: Date;
}
export interface CookingSessionFeedParams {
    limit?: number;
    offset?: number;
    userId?: string;
    following?: boolean;
    visibility?: Visibility;
}
export interface CreateCookingSessionDTO {
    recipeId: string;
    scheduledFor?: Date;
    maxParticipants?: number;
    visibility?: Visibility;
    servings: number;
    orientation?: 'vertical' | 'horizontal';
}
export interface UpdateCookingSessionDTO {
    status?: CookingSessionStatus;
    scheduledFor?: Date;
    maxParticipants?: number;
    visibility?: Visibility;
}
export interface UpdateStepProgressDTO extends Partial<StepProgress> {
    isCompleted: boolean;
}
export interface UpdateTimerDTO {
    action: 'start' | 'pause' | 'resume' | 'stop';
    remainingSeconds?: number;
}

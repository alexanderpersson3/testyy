import { ObjectId } from 'mongodb';
import type { CreateCollectionDTO, DataExportRequest, FollowResponse } from '../types/index.js';
import { UserProfile, UpdateProfileDTO, GDPRConsentDTO } from '../types/user.js';
export declare class UserProfileService {
    private static instance;
    private readonly COLLECTION;
    private db;
    private ws;
    private constructor();
    static getInstance(): UserProfileService;
    private getCollection;
    getProfile(userId: ObjectId, viewerId?: ObjectId): Promise<Partial<UserProfile>>;
    updateProfile(userId: ObjectId, updates: UpdateProfileDTO): Promise<UserProfile>;
    followUser(followerId: ObjectId, targetId: ObjectId): Promise<FollowResponse>;
    unfollowUser(followerId: ObjectId, targetId: ObjectId): Promise<FollowResponse>;
    createCollection(userId: ObjectId, collection: CreateCollectionDTO): Promise<UserProfile>;
    updateGDPRConsent(userId: ObjectId, consent: GDPRConsentDTO): Promise<void>;
    requestDataExport(userId: ObjectId, request: DataExportRequest): Promise<void>;
    deleteAccount(userId: ObjectId): Promise<void>;
    private canViewContent;
}

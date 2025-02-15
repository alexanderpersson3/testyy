import type { Collection } from 'mongodb';
import { User } from '../types/user.js';
export interface Invitation {
    _id?: ObjectId;
    email: string;
    name: string;
    invitedBy: ObjectId;
    token: string;
    status: 'pending' | 'accepted' | 'expired';
    createdAt: Date;
    expiresAt: Date;
    acceptedAt?: Date;
}
export declare class InvitationService {
    private invitationsCollection;
    private usersCollection;
    constructor(invitationsCollection: Collection<Invitation>, usersCollection: Collection<User>);
    createInvitation(invitedBy: ObjectId, email: string, name: string): Promise<Invitation>;
    getInvitation(token: string): Promise<Invitation | null>;
    acceptInvitation(token: string): Promise<void>;
    getUserInvitations(userId: ObjectId): Promise<Invitation[]>;
    cleanupExpiredInvitations(): Promise<void>;
    private generateToken;
}

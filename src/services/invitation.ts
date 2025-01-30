import { Collection, ObjectId } from 'mongodb';
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

export class InvitationService {
  constructor(
    private invitationsCollection: Collection<Invitation>,
    private usersCollection: Collection<User>
  ) {}

  async createInvitation(invitedBy: ObjectId, email: string, name: string): Promise<Invitation> {
    // Check if user is already registered
    const existingUser = await this.usersCollection.findOne({ email });
    if (existingUser) {
      throw new Error('User already registered');
    }

    // Check if there's a pending invitation
    const existingInvitation = await this.invitationsCollection.findOne({
      email,
      status: 'pending'
    });
    if (existingInvitation) {
      throw new Error('Invitation already sent');
    }

    // Create new invitation
    const invitation: Invitation = {
      email,
      name,
      invitedBy,
      token: this.generateToken(),
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
    };

    await this.invitationsCollection.insertOne(invitation);
    return invitation;
  }

  async getInvitation(token: string): Promise<Invitation | null> {
    return this.invitationsCollection.findOne({ token });
  }

  async acceptInvitation(token: string): Promise<void> {
    const invitation = await this.invitationsCollection.findOne({ token });
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await this.invitationsCollection.updateOne(
        { token },
        { $set: { status: 'expired' } }
      );
      throw new Error('Invitation has expired');
    }

    await this.invitationsCollection.updateOne(
      { token },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      }
    );
  }

  async getUserInvitations(userId: ObjectId): Promise<Invitation[]> {
    return this.invitationsCollection
      .find({
        invitedBy: userId,
        status: 'pending'
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async cleanupExpiredInvitations(): Promise<void> {
    await this.invitationsCollection.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { status: 'expired' }
      }
    );
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
} 
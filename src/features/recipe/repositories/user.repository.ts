import { ObjectId } from 'mongodb';
import type { Filter, Sort, UpdateFilter } from 'mongodb';
import { BaseRepository } from '../db/base.repository.js';
import type { MongoDocument } from '../types/mongodb.types.js';

/**
 * User preferences
 */
export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  emailNotifications: boolean;
  timezone: string;
}

/**
 * User stats
 */
export interface UserStats {
  recipesCreated: number;
  recipesLiked: number;
  recipesSaved: number;
  commentsPosted: number;
  ratingsGiven: number;
  collectionsCreated: number;
  lastRecipeCreatedAt?: Date;
  lastCommentPostedAt?: Date;
  lastRatingGivenAt?: Date;
}

/**
 * User profile
 */
export interface UserProfile {
  name?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
}

/**
 * User document with MongoDB fields
 */
export interface UserDocument extends MongoDocument {
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  hashedPassword: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
  stats: UserStats;
  profile?: UserProfile;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  loginAttempts: number;
  lockUntil?: Date;
}

/**
 * User search parameters
 */
export interface UserSearchParams {
  query?: string;
  role?: 'user' | 'admin';
  isVerified?: boolean;
  isActive?: boolean;
  hasLoginAttempts?: boolean;
  isLocked?: boolean;
  hasTwoFactor?: boolean;
}

/**
 * Repository for managing users in MongoDB
 */
export class UserRepository extends BaseRepository<UserDocument> {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.findOne({ username: username.toLowerCase() });
  }

  /**
   * Find user by verification token
   */
  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.findOne({ verificationToken: token });
  }

  /**
   * Find user by reset password token
   */
  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });
  }

  /**
   * Search users by parameters
   */
  async search(params: UserSearchParams): Promise<UserDocument[]> {
    const filter: Filter<UserDocument> = {};

    // Full-text search
    if (params.query) {
      filter.$or = [
        { email: { $regex: params.query, $options: 'i' } },
        { username: { $regex: params.query, $options: 'i' } },
        { name: { $regex: params.query, $options: 'i' } }
      ];
    }

    // Filter by role
    if (params.role) {
      filter.role = params.role;
    }

    // Filter by verification status
    if (typeof params.isVerified === 'boolean') {
      filter.isVerified = params.isVerified;
    }

    // Filter by active status
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    // Filter by login attempts
    if (params.hasLoginAttempts) {
      filter.loginAttempts = { $gt: 0 };
    }

    // Filter by locked status
    if (params.isLocked) {
      filter.lockUntil = { $gt: new Date() };
    }

    // Filter by 2FA status
    if (typeof params.hasTwoFactor === 'boolean') {
      filter.twoFactorEnabled = params.hasTwoFactor;
    }

    return this.find(filter);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: ObjectId,
    profile: Partial<UserProfile>
  ): Promise<UserDocument | null> {
    return this.updateById(userId, { profile });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: ObjectId,
    preferences: Partial<UserPreferences>
  ): Promise<UserDocument | null> {
    const update: UpdateFilter<UserDocument> = {
      $set: {
        ...(preferences.language && { 'preferences.language': preferences.language }),
        ...(preferences.theme && { 'preferences.theme': preferences.theme }),
        ...(typeof preferences.notifications === 'boolean' && {
          'preferences.notifications': preferences.notifications
        }),
        ...(typeof preferences.emailNotifications === 'boolean' && {
          'preferences.emailNotifications': preferences.emailNotifications
        }),
        ...(preferences.timezone && { 'preferences.timezone': preferences.timezone })
      }
    };
    const result = await this.collection.findOneAndUpdate(
      { _id: userId },
      update,
      { returnDocument: 'after' }
    );
    return result.value as UserDocument | null;
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: ObjectId,
    hashedPassword: string
  ): Promise<UserDocument | null> {
    return this.updateById(userId, {
      hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    });
  }

  /**
   * Set reset password token
   */
  async setResetToken(
    userId: ObjectId,
    token: string,
    expires: Date
  ): Promise<void> {
    await this.updateById(userId, {
      resetPasswordToken: token,
      resetPasswordExpires: expires
    });
  }

  /**
   * Set verification token
   */
  async setVerificationToken(userId: ObjectId, token: string): Promise<void> {
    await this.updateById(userId, { verificationToken: token });
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: ObjectId): Promise<void> {
    await this.updateById(userId, {
      isVerified: true,
      verificationToken: undefined
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId: ObjectId): Promise<void> {
    const now = new Date();
    await this.updateById(userId, {
      lastLoginAt: now,
      lastActivityAt: now,
      loginAttempts: 0,
      lockUntil: undefined
    });
  }

  /**
   * Update last activity
   */
  async updateLastActivity(userId: ObjectId): Promise<void> {
    await this.updateById(userId, {
      lastActivityAt: new Date()
    });
  }

  /**
   * Increment login attempts
   */
  async incrementLoginAttempts(userId: ObjectId): Promise<number> {
    const result = await this.collection.findOneAndUpdate(
      { _id: userId },
      {
        $inc: { loginAttempts: 1 },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );
    return result.value?.loginAttempts || 0;
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: ObjectId, until: Date): Promise<void> {
    await this.updateById(userId, { lockUntil: until });
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(
    userId: ObjectId,
    secret: string
  ): Promise<UserDocument | null> {
    return this.updateById(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true
    });
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor(userId: ObjectId): Promise<UserDocument | null> {
    return this.updateById(userId, {
      twoFactorSecret: undefined,
      twoFactorEnabled: false
    });
  }

  /**
   * Get user stats
   */
  async getStats(): Promise<{
    total: number;
    verified: number;
    active: number;
    withTwoFactor: number;
    byRole: Record<string, number>;
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verified: {
            $sum: { $cond: ['$isVerified', 1, 0] }
          },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          withTwoFactor: {
            $sum: { $cond: ['$twoFactorEnabled', 1, 0] }
          },
          byRole: {
            $push: {
              k: '$role',
              v: { $sum: 1 }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          verified: 1,
          active: 1,
          withTwoFactor: 1,
          byRole: { $arrayToObject: '$byRole' }
        }
      }
    ];

    const [stats] = await this.collection
      .aggregate<{
        total: number;
        verified: number;
        active: number;
        withTwoFactor: number;
        byRole: Record<string, number>;
      }>(pipeline)
      .toArray();

    return stats || {
      total: 0,
      verified: 0,
      active: 0,
      withTwoFactor: 0,
      byRole: {}
    };
  }
} 
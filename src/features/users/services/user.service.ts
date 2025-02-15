import { UserRepository } from '../repositories/user.repository';
import { UserProfile, UserPreferences, UserProfileResponse } from '../dto/user.dto';
import { elasticClient } from '../../../services/elastic-client';

export class UserService {
  private static instance: UserService;
  private userRepository: UserRepository;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async getUserProfile(userId: string, currentUserId?: string): Promise<UserProfileResponse | null> {
    const userProfile = await this.userRepository.getUserProfile(userId);
    
    if (!userProfile) {
      return null;
    }

    let isFollowing = false;
    if (currentUserId) {
      const followStatus = await this.userRepository.checkFollowStatus(currentUserId, userId);
      isFollowing = !!followStatus;
    }

    return {
      ...userProfile,
      isFollowing,
    };
  }

  async updateProfile(userId: string, profile: Partial<UserProfile>) {
    const updatedUser = await this.userRepository.updateProfile(userId, profile);

    // Sync with Elasticsearch
    await elasticClient.update({
      index: 'users',
      id: userId,
      body: {
        doc: {
          ...profile,
          updatedAt: new Date(),
        },
      },
    });

    return updatedUser.value;
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>) {
    const updatedUser = await this.userRepository.updatePreferences(userId, preferences);
    
    if (!updatedUser.value) {
      throw new Error('User not found');
    }

    return {
      success: true,
      message: 'Preferences updated successfully',
      preferences: updatedUser.value.preferences,
    };
  }

  async toggleFollow(followerId: string, followedId: string) {
    if (followerId === followedId) {
      throw new Error('Cannot follow yourself');
    }

    const existingFollow = await this.userRepository.checkFollowStatus(followerId, followedId);

    if (existingFollow) {
      await this.userRepository.unfollow(followerId, followedId);
      return { following: false };
    } else {
      await this.userRepository.follow(followerId, followedId);
      return { following: true };
    }
  }
} 
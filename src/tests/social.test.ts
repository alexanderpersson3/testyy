/// <reference types="jest" />
import { describe, expect, test, beforeEach } from '@jest/globals';
import { ObjectId } from 'mongodb';
import { SocialService } from '../services/social';
import { createMockCollection, MockCollection } from './helpers/mockTypes';

describe('SocialService', () => {
  let socialService: SocialService;
  let mockProfilesCollection: MockCollection;
  let mockFollowsCollection: MockCollection;
  let mockStoriesCollection: MockCollection;
  let mockUsersCollection: MockCollection;
  let mockCommentsCollection: MockCollection;
  let mockReactionsCollection: MockCollection;
  let mockBlocksCollection: MockCollection;
  let mockReportsCollection: MockCollection;
  let mockSharesCollection: MockCollection;

  beforeEach(() => {
    // Create mock collections using helper
    mockProfilesCollection = createMockCollection();
    mockFollowsCollection = createMockCollection();
    mockStoriesCollection = createMockCollection();
    mockUsersCollection = createMockCollection();
    mockCommentsCollection = createMockCollection();
    mockReactionsCollection = createMockCollection();
    mockBlocksCollection = createMockCollection();
    mockReportsCollection = createMockCollection();
    mockSharesCollection = createMockCollection();

    socialService = new SocialService({
      collection: (name: string) => {
        switch (name) {
          case 'profiles': return mockProfilesCollection;
          case 'follows': return mockFollowsCollection;
          case 'stories': return mockStoriesCollection;
          case 'users': return mockUsersCollection;
          case 'comments': return mockCommentsCollection;
          case 'reactions': return mockReactionsCollection;
          case 'blocks': return mockBlocksCollection;
          case 'reports': return mockReportsCollection;
          case 'shares': return mockSharesCollection;
          default: throw new Error(`Unknown collection: ${name}`);
        }
      }
    } as any);
  });

  describe('Profile Management', () => {
    const userId = new ObjectId();
    const mockProfile = {
      userId,
      displayName: 'Test User',
      bio: 'Test bio',
      stats: { followers: 0, following: 0, recipes: 0, likes: 0 }
    };

    test('getProfile should return user profile', async () => {
      mockProfilesCollection.findOne.mockResolvedValue(mockProfile);
      const result = await socialService.getProfile(userId);
      expect(result).toEqual(mockProfile);
      expect(mockProfilesCollection.findOne).toHaveBeenCalledWith({ userId });
    });

    test('updateProfile should update user profile', async () => {
      const updates = { displayName: 'New Name', bio: 'New bio' };
      mockProfilesCollection.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
      
      const result = await socialService.updateProfile(userId, updates);
      
      expect(result).toBe(true);
      expect(mockProfilesCollection.updateOne).toHaveBeenCalledWith(
        { userId },
        expect.objectContaining({
          $set: expect.objectContaining(updates)
        }),
        expect.any(Object)
      );
    });
  });

  describe('Story Management', () => {
    const storyId = new ObjectId();
    const userId = new ObjectId();
    const mockStory = {
      userId,
      content: 'Test story',
      mediaUrl: 'https://example.com/image.jpg',
      tags: [],
      visibility: 'public' as const
    };

    test('createStory should create new story', async () => {
      mockStoriesCollection.insertOne.mockResolvedValue({ 
        acknowledged: true,
        insertedId: storyId
      });

      const result = await socialService.createStory(mockStory);
      
      expect(result).toEqual(storyId);
      expect(mockStoriesCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          content: 'Test story',
          mediaUrl: 'https://example.com/image.jpg',
          tags: [],
          visibility: 'public'
        })
      );
    });

    test('viewStory should increment view count', async () => {
      mockStoriesCollection.updateOne.mockResolvedValue({ 
        acknowledged: true,
        modifiedCount: 1
      });

      const result = await socialService.viewStory(storyId);
      
      expect(result).toBe(true);
      expect(mockStoriesCollection.updateOne).toHaveBeenCalledWith(
        { _id: storyId },
        { $inc: { views: 1 } }
      );
    });
  });

  describe('Story Interactions', () => {
    const storyId = new ObjectId();
    const userId = new ObjectId();

    test('addComment should create new comment', async () => {
      const commentId = new ObjectId();
      const content = 'Test comment';
      
      mockCommentsCollection.insertOne.mockResolvedValue({
        acknowledged: true,
        insertedId: commentId
      });

      const result = await socialService.addComment(storyId, userId, content);
      
      expect(result).toEqual(commentId);
      expect(mockCommentsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId,
          userId,
          content,
          likes: 0
        })
      );
    });

    test('addReaction should add reaction and remove existing', async () => {
      const type = 'like' as const;
      
      mockReactionsCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
      mockReactionsCollection.insertOne.mockResolvedValue({ acknowledged: true });

      const result = await socialService.addReaction(storyId, userId, type);
      
      expect(result).toBe(true);
      expect(mockReactionsCollection.deleteOne).toHaveBeenCalledWith({ storyId, userId });
      expect(mockReactionsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId,
          userId,
          type
        })
      );
    });
  });

  describe('Follow System', () => {
    const followerId = new ObjectId();
    const followingId = new ObjectId();

    test('followUser should create follow relationship', async () => {
      mockFollowsCollection.insertOne.mockResolvedValue({ acknowledged: true });
      mockProfilesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await socialService.followUser(followerId, followingId);
      
      expect(result).toBe(true);
      expect(mockFollowsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          followerId,
          followingId
        })
      );
      expect(mockProfilesCollection.updateOne).toHaveBeenCalledTimes(2); // Updates both users' stats
    });

    test('unfollowUser should remove follow relationship', async () => {
      mockFollowsCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
      mockProfilesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await socialService.unfollowUser(followerId, followingId);
      
      expect(result).toBe(true);
      expect(mockFollowsCollection.deleteOne).toHaveBeenCalledWith({
        followerId,
        followingId
      });
      expect(mockProfilesCollection.updateOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('User Safety', () => {
    const blockerId = new ObjectId();
    const blockedId = new ObjectId();
    const reporterId = new ObjectId();
    const contentId = new ObjectId();

    test('blockUser should create block and remove follows', async () => {
      mockBlocksCollection.findOne.mockResolvedValue(null);
      mockBlocksCollection.insertOne.mockResolvedValue({ acknowledged: true });
      mockFollowsCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await socialService.blockUser(blockerId, blockedId, 'Test reason');
      
      expect(result).toBe(true);
      expect(mockBlocksCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          blockerId,
          blockedId,
          reason: 'Test reason'
        })
      );
      expect(mockFollowsCollection.deleteOne).toHaveBeenCalledTimes(2);
    });

    test('reportContent should create content report', async () => {
      const reportId = new ObjectId();
      mockReportsCollection.insertOne.mockResolvedValue({
        acknowledged: true,
        insertedId: reportId
      });

      const result = await socialService.reportContent(
        reporterId,
        'story',
        contentId,
        'inappropriate',
        'Test description'
      );
      
      expect(result).toEqual(reportId);
      expect(mockReportsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          reporterId,
          contentType: 'story',
          contentId,
          reason: 'inappropriate',
          description: 'Test description',
          status: 'pending'
        })
      );
    });
  });

  describe('Profile Customization', () => {
    const userId = new ObjectId();
    const customization = {
      theme: 'dark' as const,
      layout: 'grid' as const,
      showStats: true,
      privacySettings: {
        profileVisibility: 'public' as const,
        storyComments: 'followers' as const,
        allowSharing: true,
        showActivity: true
      }
    };

    test('updateProfileCustomization should update settings', async () => {
      mockProfilesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await socialService.updateProfileCustomization(userId, customization);
      
      expect(result).toBe(true);
      expect(mockProfilesCollection.updateOne).toHaveBeenCalledWith(
        { userId },
        expect.objectContaining({
          $set: expect.objectContaining({
            customization: expect.objectContaining(customization)
          })
        })
      );
    });

    test('getProfileCustomization should return settings', async () => {
      mockProfilesCollection.findOne.mockResolvedValue({ customization });

      const result = await socialService.getProfileCustomization(userId);
      
      expect(result).toEqual(customization);
      expect(mockProfilesCollection.findOne).toHaveBeenCalledWith(
        { userId },
        { projection: { customization: 1 } }
      );
    });
  });
}); 

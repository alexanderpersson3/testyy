import { describe, expect, test, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { SocialService } from '../../services/social';
import { TestDatabase } from '../helpers/dbHelper';
import { WithId } from 'mongodb';
import { User } from '../../types/user';

describe('SocialService Integration Tests', () => {
  let socialService: SocialService;
  let testUser1: WithId<User>;
  let testUser2: WithId<User>;

  beforeAll(async () => {
    await TestDatabase.connect();
    socialService = new SocialService(TestDatabase['db']);
    testUser1 = await TestDatabase.createTestUser();
    testUser2 = await TestDatabase.createTestUser();
  });

  beforeEach(async () => {
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    await TestDatabase.disconnect();
  });

  describe('Profile Management', () => {
    test('should create and retrieve user profile', async () => {
      const profile = await socialService.getProfile(testUser1._id);
      expect(profile).toBeDefined();
      expect(profile?.displayName).toBe('Test User');
      expect(profile?.userId).toEqual(testUser1._id);
    });

    test('should update user profile', async () => {
      const updates = {
        displayName: 'Updated Name',
        bio: 'Updated bio'
      };

      await socialService.updateProfile(testUser1._id, updates);
      const profile = await socialService.getProfile(testUser1._id);

      expect(profile?.displayName).toBe('Updated Name');
      expect(profile?.bio).toBe('Updated bio');
    });
  });

  describe('Follow System', () => {
    test('should create follow relationship', async () => {
      await socialService.followUser(testUser1._id, testUser2._id);
      
      const profile1 = await socialService.getProfile(testUser1._id);
      const profile2 = await socialService.getProfile(testUser2._id);

      expect(profile1?.stats.following).toBe(1);
      expect(profile2?.stats.followers).toBe(1);
    });

    test('should remove follow relationship', async () => {
      await socialService.followUser(testUser1._id, testUser2._id);
      await socialService.unfollowUser(testUser1._id, testUser2._id);
      
      const profile1 = await socialService.getProfile(testUser1._id);
      const profile2 = await socialService.getProfile(testUser2._id);

      expect(profile1?.stats.following).toBe(0);
      expect(profile2?.stats.followers).toBe(0);
    });
  });

  describe('Story System', () => {
    test('should create and retrieve story', async () => {
      const createdStory = await TestDatabase.createTestStory(testUser1._id);
      const stories = await socialService.getStories(testUser1._id);

      expect(stories).toHaveLength(1);
      expect(stories[0].content).toBe('Test story');
      expect(stories[0].userId).toEqual(testUser1._id);
      expect(stories[0]._id).toEqual(createdStory._id);
    });

    test('should handle story views', async () => {
      const story = await TestDatabase.createTestStory(testUser1._id);
      await socialService.viewStory(story._id);
      
      const stories = await socialService.getStories(testUser1._id);
      expect(stories[0].views).toBe(1);
    });

    test('should handle story comments', async () => {
      const story = await TestDatabase.createTestStory(testUser1._id);
      await socialService.addComment(story._id, testUser2._id, 'Test comment');

      const comments = await socialService.getStoryComments(story._id);
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('Test comment');
      expect(comments[0].userId).toEqual(testUser2._id);
    });

    test('should handle story reactions', async () => {
      const story = await TestDatabase.createTestStory(testUser1._id);
      await socialService.addReaction(story._id, testUser2._id, 'like');

      const reactions = await socialService.getStoryReactions(story._id);
      expect(reactions.length).toBe(1);
      expect(reactions[0].type).toBe('like');
    });
  });

  describe('User Safety', () => {
    test('should handle user blocking', async () => {
      await socialService.followUser(testUser1._id, testUser2._id);
      await socialService.blockUser(testUser1._id, testUser2._id, 'Test reason');

      const profile1 = await socialService.getProfile(testUser1._id);
      const profile2 = await socialService.getProfile(testUser2._id);
      const blockedUsers = await socialService.getUserBlocks(testUser1._id);

      expect(profile1?.stats.following).toBe(0);
      expect(profile2?.stats.followers).toBe(0);
      expect(blockedUsers).toHaveLength(1);
      expect(blockedUsers[0]._id).toEqual(testUser2._id);
    });

    test('should handle content reporting', async () => {
      const story = await TestDatabase.createTestStory(testUser2._id);
      const reportId = await socialService.reportContent(
        testUser1._id,
        'story',
        story._id,
        'inappropriate',
        'Test description'
      );

      expect(reportId).toBeDefined();
    });
  });

  describe('Story Sharing', () => {
    test('should share story with specific user', async () => {
      const story = await TestDatabase.createTestStory(testUser1._id);
      const shareId = await socialService.shareStory(
        story._id,
        testUser2._id,
        testUser1._id,
        'Check this out!'
      );

      expect(shareId).toBeDefined();

      const shares = await socialService.getStoryShares(story._id);
      expect(shares).toHaveLength(1);
      expect(shares[0].message).toBe('Check this out!');
      expect(shares[0].sharedToId).toEqual(testUser1._id);
    });

    test('should share story publicly', async () => {
      const story = await TestDatabase.createTestStory(testUser1._id);
      await socialService.shareStory(story._id, testUser2._id);

      const shares = await socialService.getStoryShares(story._id);
      expect(shares).toHaveLength(1);
      expect(shares[0].sharedToId).toBeUndefined();
    });
  });

  describe('Profile Customization', () => {
    test('should update profile theme and layout', async () => {
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

      await socialService.updateProfileCustomization(testUser1._id, customization);
      const result = await socialService.getProfileCustomization(testUser1._id);

      expect(result).toMatchObject(customization);
    });

    test('should respect privacy settings', async () => {
      // Set profile to private
      await socialService.updateProfileCustomization(testUser1._id, {
        privacySettings: {
          profileVisibility: 'private' as const,
          storyComments: 'none' as const,
          allowSharing: false,
          showActivity: false
        }
      });

      // Try to add comment (should fail)
      const story = await TestDatabase.createTestStory(testUser1._id);
      const commentPromise = socialService.addComment(
        story._id,
        testUser2._id,
        'Test comment'
      );

      await expect(commentPromise).rejects.toThrow();
    });
  });

  describe('Content Discovery', () => {
    test('should get personalized explore feed', async () => {
      // Create multiple stories with different engagement levels
      const story1 = await TestDatabase.createTestStory(testUser1._id);
      const story2 = await TestDatabase.createTestStory(testUser1._id);
      const story3 = await TestDatabase.createTestStory(testUser2._id);

      // Add engagement
      await socialService.addReaction(story1._id, testUser2._id, 'like');
      await socialService.addComment(story1._id, testUser2._id, 'Great!');
      await socialService.addReaction(story2._id, testUser2._id, 'like');

      const feed = await socialService.getExploreFeed(testUser2._id, 1, 10);
      expect(feed).toHaveLength(3);
      expect(feed[0]._id).toEqual(story1._id); // Most engagement should be first
    });

    test('should get popular users', async () => {
      // Create follows
      await socialService.followUser(testUser2._id, testUser1._id);
      await socialService.followUser(testUser1._id, testUser2._id);

      const popularUsers = await socialService.getPopularUsers(5);
      expect(popularUsers).toHaveLength(2);
      expect(popularUsers[0].stats.followers).toBeGreaterThan(0);
    });
  });

  describe('Complex Interactions', () => {
    test('should handle blocking user with existing interactions', async () => {
      // Create initial interactions
      await socialService.followUser(testUser1._id, testUser2._id);
      const story = await TestDatabase.createTestStory(testUser2._id);
      await socialService.addReaction(story._id, testUser1._id, 'like');
      await socialService.addComment(story._id, testUser1._id, 'Nice!');

      // Block user
      await socialService.blockUser(testUser1._id, testUser2._id, 'Test reason');

      // Verify interactions are removed
      const profile1 = await socialService.getProfile(testUser1._id);
      const profile2 = await socialService.getProfile(testUser2._id);
      const reactions = await socialService.getStoryReactions(story._id);
      const comments = await socialService.getStoryComments(story._id);

      expect(profile1?.stats.following).toBe(0);
      expect(profile2?.stats.followers).toBe(0);
      expect(reactions.length).toBe(0);
      expect(comments.length).toBe(0);
    });

    test('should handle story expiration', async () => {
      // Create expired story
      const expiredStory = await TestDatabase.createTestStory(testUser1._id, {
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      // Create active story
      const activeStory = await TestDatabase.createTestStory(testUser1._id, {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });

      const stories = await socialService.getStories(testUser1._id);
      const storyIds = stories.map(s => s._id.toString());

      expect(storyIds).not.toContain(expiredStory._id.toString());
      expect(storyIds).toContain(activeStory._id.toString());
    });
  });
}); 
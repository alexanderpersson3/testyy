import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TestDatabase } from '../helpers/dbHelper';
import { SocialService } from '../../services/social';
describe('Social Service Performance Tests', () => {
    let socialService;
    let testUsers = [];
    let testStories = [];
    const NUM_USERS = 100;
    const NUM_STORIES = 500;
    const NUM_COMMENTS = 1000;
    const NUM_REACTIONS = 2000;
    beforeAll(async () => {
        await TestDatabase.connect();
        socialService = new SocialService(TestDatabase['db']);
        // Create test users
        testUsers = await Promise.all(Array.from({ length: NUM_USERS }, async (_, i) => {
            const user = await TestDatabase.createTestUser({
                email: `user${i}@test.com`,
                name: `User ${i}`,
                isPremium: false
            });
            await TestDatabase.createTestProfile(user._id);
            return user;
        }));
        // Create test stories
        for (let i = 0; i < NUM_STORIES; i++) {
            const story = await TestDatabase.createTestStory(testUsers[i % NUM_USERS]._id, { content: `Story ${i}` });
            testStories.push(story);
        }
        // Create test comments
        for (let i = 0; i < NUM_COMMENTS; i++) {
            await socialService.addComment(testStories[i % NUM_STORIES]._id, testUsers[i % NUM_USERS]._id, `Comment ${i}`);
        }
        // Create test reactions
        for (let i = 0; i < NUM_REACTIONS; i++) {
            await socialService.addReaction(testStories[i % NUM_STORIES]._id, testUsers[i % NUM_USERS]._id, 'like');
        }
        // Create follow relationships
        for (let i = 0; i < NUM_USERS; i++) {
            for (let j = 0; j < 5; j++) { // Each user follows 5 random users
                const followeeIndex = (i + j + 1) % NUM_USERS;
                await socialService.followUser(testUsers[i]._id, testUsers[followeeIndex]._id);
            }
        }
    });
    afterAll(async () => {
        await TestDatabase.disconnect();
    });
    beforeEach(async () => {
        await TestDatabase.cleanup();
    });
    describe('Feed Generation Performance', () => {
        test('should efficiently generate explore feed', async () => {
            const startTime = Date.now();
            const results = await socialService.getExploreFeed(testUsers[0]._id, 1, 20);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(1000); // Should take less than 1 second
            expect(results.length).toBeLessThanOrEqual(20);
        });
        test('should efficiently get user stories with comments', async () => {
            const startTime = Date.now();
            const stories = await socialService.getStories(testUsers[0]._id);
            for (const story of stories.slice(0, 5)) {
                await socialService.getStoryComments(story._id);
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500); // Should take less than 500ms
        });
    });
    describe('Social Graph Performance', () => {
        test('should efficiently get followers with pagination', async () => {
            const startTime = Date.now();
            const followers = await socialService.getFollowers(testUsers[0]._id);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(200); // Should take less than 200ms
            expect(followers.length).toBe(NUM_USERS - 1);
        });
        test('should efficiently check follow relationships', async () => {
            const startTime = Date.now();
            const checkCount = 100;
            const promises = [];
            for (let i = 0; i < checkCount; i++) {
                const followerId = testUsers[i % NUM_USERS]._id;
                const followingId = testUsers[(i + 1) % NUM_USERS]._id;
                promises.push(socialService.isFollowing(followerId, followingId));
            }
            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(1000); // Should take less than 1 second for 100 checks
        });
    });
    describe('Content Interaction Performance', () => {
        test('should efficiently handle multiple reactions', async () => {
            const startTime = Date.now();
            const reactionCount = 50;
            const promises = [];
            for (let i = 0; i < reactionCount; i++) {
                promises.push(socialService.addReaction(testStories[i % NUM_STORIES]._id, testUsers[i % NUM_USERS]._id, 'like'));
            }
            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(2000); // Should take less than 2 seconds for 50 reactions
        });
        test('should efficiently get story statistics', async () => {
            const startTime = Date.now();
            const statsCount = 20;
            const promises = [];
            for (let i = 0; i < statsCount; i++) {
                const storyId = testStories[i]._id;
                promises.push(Promise.all([
                    socialService.getStoryComments(storyId),
                    socialService.getStoryReactions(storyId),
                    socialService.getStoryShares(storyId)
                ]));
            }
            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(1000); // Should take less than 1 second for 20 stories
        });
    });
    describe('Search and Filter Performance', () => {
        test('should efficiently search stories by content', async () => {
            const startTime = Date.now();
            const results = await socialService.searchStories('Story', 1, 20);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500); // Should take less than 500ms
            expect(results.length).toBeLessThanOrEqual(20);
        });
        test('should efficiently filter stories by date range', async () => {
            const startTime = Date.now();
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
            const results = await socialService.getStoriesByDateRange(startDate, endDate, 1, 20);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500); // Should take less than 500ms
            expect(results.length).toBeLessThanOrEqual(20);
        });
    });
});
//# sourceMappingURL=social.perf.test.js.map
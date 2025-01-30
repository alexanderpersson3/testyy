import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SocialService } from '../services/social.js';
const router = express.Router();
// Get user profile
router.get('/profiles/:userId', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const profile = await socialService.getProfile(new ObjectId(req.params.userId));
    if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
    }
    res.json({ profile });
}));
// Update user profile
router.patch('/profiles/me', auth, [
    check('displayName').optional().trim().notEmpty(),
    check('bio').optional().trim(),
    check('socialLinks').optional().isObject(),
    check('socialLinks.instagram').optional().isURL(),
    check('socialLinks.facebook').optional().isURL(),
    check('socialLinks.website').optional().isURL()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.updateProfile(new ObjectId(req.user.id), req.body);
    if (!success) {
        return res.status(500).json({ message: 'Failed to update profile' });
    }
    res.json({ success: true });
}));
// Add profile highlight
router.post('/profiles/me/highlights', auth, [
    check('title').trim().notEmpty(),
    check('description').optional().trim(),
    check('mediaUrl').isURL(),
    check('mediaType').isIn(['image', 'video'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const highlightId = await socialService.addHighlight(new ObjectId(req.user.id), req.body);
    if (!highlightId) {
        return res.status(500).json({ message: 'Failed to add highlight' });
    }
    res.status(201).json({ highlightId });
}));
// Remove profile highlight
router.delete('/profiles/me/highlights/:highlightId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.removeHighlight(new ObjectId(req.user.id), new ObjectId(req.params.highlightId));
    if (!success) {
        return res.status(404).json({ message: 'Highlight not found' });
    }
    res.json({ success: true });
}));
// Follow user
router.post('/follow/:userId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.followUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
    if (!success) {
        return res.status(400).json({ message: 'Already following or failed to follow' });
    }
    res.json({ success: true });
}));
// Unfollow user
router.delete('/follow/:userId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.unfollowUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
    if (!success) {
        return res.status(404).json({ message: 'Not following this user' });
    }
    res.json({ success: true });
}));
// Get user followers
router.get('/followers/:userId', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const followers = await socialService.getFollowers(new ObjectId(req.params.userId));
    const total = await socialService.getFollowersCount(new ObjectId(req.params.userId));
    res.json({
        followers,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Get user following
router.get('/following/:userId', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const following = await socialService.getFollowing(new ObjectId(req.params.userId));
    const total = await socialService.getFollowingCount(new ObjectId(req.params.userId));
    res.json({
        following,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Create story
router.post('/stories', auth, [
    check('type').isIn(['image', 'video', 'text']),
    check('content').trim().notEmpty(),
    check('mediaUrl').optional().isURL(),
    check('expiresAt').isISO8601()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const story = {
        userId: new ObjectId(req.user.id),
        content: req.body.content,
        media: req.body.mediaUrl ? [req.body.mediaUrl] : undefined,
        tags: req.body.tags || [],
        visibility: req.body.visibility || 'public'
    };
    const storyId = await socialService.createStory(story);
    if (!storyId) {
        return res.status(500).json({ message: 'Failed to create story' });
    }
    res.status(201).json({ storyId });
}));
// Get user stories
router.get('/stories/:userId', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const stories = await socialService.getStories(new ObjectId(req.params.userId));
    res.json({ stories });
}));
// View story
router.post('/stories/:storyId/view', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.viewStory(new ObjectId(req.params.storyId));
    if (!success) {
        return res.status(404).json({ message: 'Story not found' });
    }
    res.json({ success: true });
}));
// Get explore feed
router.get('/explore', auth, [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const content = await socialService.getExploreFeed(new ObjectId(req.user.id), parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
    res.json({ content });
}));
// Get popular users
router.get('/popular', [
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const users = await socialService.getPopularUsers(parseInt(req.query.limit) || 10);
    res.json({ users });
}));
// Add comment to story
router.post('/stories/:storyId/comments', auth, [
    check('content').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const commentId = await socialService.addComment(new ObjectId(req.params.storyId), new ObjectId(req.user.id), req.body.content);
    if (!commentId) {
        return res.status(500).json({ message: 'Failed to add comment' });
    }
    res.status(201).json({ commentId });
}));
// Get story comments
router.get('/stories/:storyId/comments', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const comments = await socialService.getStoryComments(new ObjectId(req.params.storyId));
    const total = await socialService.getStoryCommentsCount(new ObjectId(req.params.storyId));
    res.json({
        comments,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Add reaction to story
router.post('/stories/:storyId/reactions', auth, [
    check('type').isIn(['❤️', '👍', '😂', '😮', '😢', '😡'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.addReaction(new ObjectId(req.params.storyId), new ObjectId(req.user.id), req.body.type);
    if (!success) {
        return res.status(500).json({ message: 'Failed to add reaction' });
    }
    res.json({ success: true });
}));
// Remove reaction from story
router.delete('/stories/:storyId/reactions', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.removeReaction(new ObjectId(req.params.storyId), new ObjectId(req.user.id));
    if (!success) {
        return res.status(404).json({ message: 'Reaction not found' });
    }
    res.json({ success: true });
}));
// Get story reactions
router.get('/stories/:storyId/reactions', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const reactions = await socialService.getStoryReactions(new ObjectId(req.params.storyId));
    res.json({ reactions });
}));
// Share story
router.post('/stories/:storyId/share', auth, [
    check('sharedToId').optional().isMongoId(),
    check('message').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const shareId = await socialService.shareStory(new ObjectId(req.params.storyId), new ObjectId(req.user.id), req.body.sharedToId ? new ObjectId(req.body.sharedToId) : undefined, req.body.message);
    if (!shareId) {
        return res.status(500).json({ message: 'Failed to share story' });
    }
    res.status(201).json({ shareId });
}));
// Get story shares
router.get('/stories/:storyId/shares', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const shares = await socialService.getStoryShares(new ObjectId(req.params.storyId));
    res.json({ shares });
}));
// Block user
router.post('/block/:userId', auth, [
    check('reason').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.blockUser(new ObjectId(req.user.id), new ObjectId(req.params.userId), req.body.reason);
    if (!success) {
        return res.status(400).json({ message: 'Already blocked or failed to block' });
    }
    res.json({ success: true });
}));
// Unblock user
router.delete('/block/:userId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.unblockUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
    if (!success) {
        return res.status(404).json({ message: 'Block not found' });
    }
    res.json({ success: true });
}));
// Get blocked users
router.get('/blocked', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const blockedUsers = await socialService.getUserBlocks(new ObjectId(req.user.id));
    res.json({ blockedUsers });
}));
// Report content
router.post('/report', auth, [
    check('contentType').isIn(['story', 'comment', 'profile']),
    check('contentId').isMongoId(),
    check('reason').isIn(['inappropriate', 'spam', 'offensive', 'fake', 'other']),
    check('description').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const reportId = await socialService.reportContent(new ObjectId(req.user.id), req.body.contentType, new ObjectId(req.body.contentId), req.body.reason, req.body.description);
    if (!reportId) {
        return res.status(500).json({ message: 'Failed to submit report' });
    }
    res.status(201).json({ reportId });
}));
// Update profile customization
router.patch('/profiles/me/customization', auth, [
    check('theme').optional().isIn(['light', 'dark', 'system']),
    check('accentColor').optional().matches(/^#[0-9A-F]{6}$/i),
    check('fontPreference').optional().isString(),
    check('layout').optional().isIn(['grid', 'list']),
    check('showStats').optional().isBoolean(),
    check('privacySettings').optional().isObject(),
    check('privacySettings.profileVisibility').optional().isIn(['public', 'followers', 'private']),
    check('privacySettings.storyComments').optional().isIn(['everyone', 'followers', 'none']),
    check('privacySettings.allowSharing').optional().isBoolean(),
    check('privacySettings.showActivity').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const success = await socialService.updateProfileCustomization(new ObjectId(req.user.id), req.body);
    if (!success) {
        return res.status(500).json({ message: 'Failed to update customization' });
    }
    res.json({ success: true });
}));
// Get profile customization
router.get('/profiles/:userId/customization', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const socialService = new SocialService(db);
    const customization = await socialService.getProfileCustomization(new ObjectId(req.params.userId));
    if (!customization) {
        return res.status(404).json({ message: 'Customization not found' });
    }
    res.json({ customization });
}));
export default router;
//# sourceMappingURL=social.js.map
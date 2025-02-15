import express, {} from 'express';
;
import { ObjectId } from 'mongodb';
;
import bcrypt from 'bcryptjs';
import { db, DatabaseService } from '../db/database.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { auth } from '../middleware/auth.js';
const router = express.Router();
// Get user profile by ID
router.get('/:id/profile', auth, async (req, res) => {
    try {
        const userId = new ObjectId(req.params.id);
        const user = await db.getCollection('users').findOne({ _id: userId }, { projection: { password: 0 } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Get user's recipes count
        const recipesCount = await db.getCollection('recipes').countDocuments({
            authorId: userId,
        });
        // Get followers count
        const followersCount = await db.getCollection('user_followers').countDocuments({
            followedId: userId,
        });
        // Get following count
        const followingCount = await db.getCollection('user_followers').countDocuments({
            followerId: userId,
        });
        res.json({
            ...user,
            stats: {
                recipes: recipesCount,
                followers: followersCount,
                following: followingCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});
// Update user profile
router.put('/:id', auth, async (req, res) => {
    try {
        const userId = new ObjectId(req.params.id);
        if (!req.user || req.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this profile' });
        }
        const result = await db.getCollection('users').updateOne({ _id: userId }, { $set: { ...req.body, updatedAt: new Date() } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'Profile updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Follow a user
router.post('/:id/follow', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const followerId = req.user._id;
        const followedId = new ObjectId(req.params.id);
        if (followerId.equals(followedId)) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }
        const existingFollow = await db.getCollection('user_followers').findOne({
            followerId,
            followedId,
        });
        if (existingFollow) {
            return res.status(400).json({ error: 'Already following this user' });
        }
        await db.getCollection('user_followers').insertOne({
            followerId,
            followedId,
            createdAt: new Date(),
        });
        res.json({ message: 'Successfully followed user' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to follow user' });
    }
});
// Unfollow a user
router.delete('/:id/follow', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const followerId = req.user._id;
        const followedId = new ObjectId(req.params.id);
        const result = await db.getCollection('user_followers').deleteOne({
            followerId,
            followedId,
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Not following this user' });
        }
        res.json({ message: 'Successfully unfollowed user' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
});
// Get user's followers
router.get('/:id/followers', auth, async (req, res) => {
    try {
        const userId = new ObjectId(req.params.id);
        const followers = await db.getCollection('user_followers')
            .aggregate([
            { $match: { followedId: userId } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'followerId',
                    foreignField: '_id',
                    as: 'follower',
                },
            },
            { $unwind: '$follower' },
            {
                $project: {
                    '_id': '$follower._id',
                    'name': '$follower.name',
                    'createdAt': 1,
                },
            },
        ])
            .toArray();
        res.json(followers);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get followers' });
    }
});
// Get user's following
router.get('/:id/following', auth, async (req, res) => {
    try {
        const userId = new ObjectId(req.params.id);
        const following = await db.getCollection('user_followers')
            .aggregate([
            { $match: { followerId: userId } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'followedId',
                    foreignField: '_id',
                    as: 'following',
                },
            },
            { $unwind: '$following' },
            {
                $project: {
                    '_id': '$following._id',
                    'name': '$following.name',
                    'createdAt': 1,
                },
            },
        ])
            .toArray();
        res.json(following);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get following' });
    }
});
// Get popular users
router.get('/popular', auth, asyncHandler(async (req, res) => {
    const dbService = DatabaseService.getInstance();
    await dbService.connect();
    const db = dbService.getDb();
    const popularUsers = await db
        .collection('users')
        .aggregate([
        {
            $lookup: {
                from: 'user_followers',
                localField: '_id',
                foreignField: 'followedId',
                as: 'followers',
            },
        },
        {
            $lookup: {
                from: 'recipes',
                localField: '_id',
                foreignField: 'authorId',
                as: 'recipes',
            },
        },
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                bio: 1,
                followersCount: { $size: '$followers' },
                recipesCount: { $size: '$recipes' },
            },
        },
        { $sort: { followersCount: -1 } },
        { $limit: 10 },
    ])
        .toArray();
    res.json({ users: popularUsers });
}));
// Delete user account
router.delete('/account', auth, [check('password').exists()], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const dbService = DatabaseService.getInstance();
    await dbService.connect();
    const db = dbService.getDb();
    const user = await db.collection('users').findOne({
        _id: new ObjectId(req.user.id),
    });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const isValidPassword = await bcrypt.compare(req.body.password, user.password);
    if (!isValidPassword) {
        return res.status(400).json({ message: 'Invalid password' });
    }
    // Delete user's data
    await Promise.all([
        // Delete user account
        db.collection('users').deleteOne({ _id: new ObjectId(req.user.id) }),
        // Delete user's refresh tokens
        db.collection('refreshTokens').deleteMany({ userId: new ObjectId(req.user.id) }),
        // Delete user's recipes
        db.collection('recipes').deleteMany({ authorId: new ObjectId(req.user.id) }),
    ]);
    res.json({ success: true });
}));
export default router;
//# sourceMappingURL=users.js.map
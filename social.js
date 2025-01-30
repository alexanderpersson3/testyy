const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const auth = require('./middleware/auth');
const { users, recipes, likes, comments, followers } = require('./collection');

const router = express.Router();

// Validation middleware
const validateComment = [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
];

// Like/Unlike a recipe
router.post('/recipes/:recipeId/like', auth, async (req, res) => {
  try {
    const recipeId = new ObjectId(req.params.recipeId);
    const likesCollection = await likes();

    // Check if already liked
    const existingLike = await likesCollection.findOne({
      recipeId,
      userId: req.userId,
    });

    if (existingLike) {
      // Unlike
      await likesCollection.deleteOne({ _id: existingLike._id });
      res.json({ success: true, message: 'Recipe unliked', liked: false });
    } else {
      // Like
      await likesCollection.insertOne({
        recipeId,
        userId: req.userId,
        createdAt: new Date(),
      });
      res.json({ success: true, message: 'Recipe liked', liked: true });
    }
  } catch (error) {
    console.error('Like/Unlike error:', error);
    res.status(500).json({ success: false, message: 'Failed to like/unlike recipe' });
  }
});

// Get recipe likes count
router.get('/recipes/:recipeId/likes', async (req, res) => {
  try {
    const recipeId = new ObjectId(req.params.recipeId);
    const likesCollection = await likes();

    const count = await likesCollection.countDocuments({ recipeId });
    const userLiked = req.userId ? 
      await likesCollection.findOne({ recipeId, userId: req.userId }) !== null : 
      false;

    res.json({ 
      success: true, 
      data: { 
        count,
        userLiked,
      } 
    });
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get likes' });
  }
});

// Add comment to recipe
router.post('/recipes/:recipeId/comments', auth, validateComment, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const recipeId = new ObjectId(req.params.recipeId);
    const commentsCollection = await comments();
    
    const comment = {
      recipeId,
      userId: req.userId,
      content: req.body.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentsCollection.insertOne(comment);
    res.status(201).json({
      success: true,
      data: { ...comment, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

// Get recipe comments
router.get('/recipes/:recipeId/comments', async (req, res) => {
  try {
    const recipeId = new ObjectId(req.params.recipeId);
    const commentsCollection = await comments();
    const usersCollection = await users();

    const recipeComments = await commentsCollection
      .find({ recipeId })
      .sort({ createdAt: -1 })
      .toArray();

    // Get user details for each comment
    const commentsWithUser = await Promise.all(
      recipeComments.map(async (comment) => {
        const user = await usersCollection.findOne(
          { _id: comment.userId },
          { projection: { password: 0 } }
        );
        return {
          ...comment,
          user: {
            id: user._id,
            name: user.name,
          },
        };
      })
    );

    res.json({ success: true, data: commentsWithUser });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Failed to get comments' });
  }
});

// Follow/Unfollow user
router.post('/users/:userId/follow', auth, async (req, res) => {
  try {
    const targetUserId = new ObjectId(req.params.userId);
    
    // Can't follow yourself
    if (targetUserId.equals(req.userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot follow yourself' 
      });
    }

    const followersCollection = await followers();

    // Check if already following
    const existingFollow = await followersCollection.findOne({
      followerId: req.userId,
      followingId: targetUserId,
    });

    if (existingFollow) {
      // Unfollow
      await followersCollection.deleteOne({ _id: existingFollow._id });
      res.json({ success: true, message: 'User unfollowed', following: false });
    } else {
      // Follow
      await followersCollection.insertOne({
        followerId: req.userId,
        followingId: targetUserId,
        createdAt: new Date(),
      });
      res.json({ success: true, message: 'User followed', following: true });
    }
  } catch (error) {
    console.error('Follow/Unfollow error:', error);
    res.status(500).json({ success: false, message: 'Failed to follow/unfollow user' });
  }
});

// Get user's followers
router.get('/users/:userId/followers', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.userId);
    const followersCollection = await followers();
    const usersCollection = await users();

    const followersList = await followersCollection
      .find({ followingId: userId })
      .toArray();

    const followersWithDetails = await Promise.all(
      followersList.map(async (follow) => {
        const user = await usersCollection.findOne(
          { _id: follow.followerId },
          { projection: { password: 0 } }
        );
        return {
          id: user._id,
          name: user.name,
          followingSince: follow.createdAt,
        };
      })
    );

    res.json({ success: true, data: followersWithDetails });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ success: false, message: 'Failed to get followers' });
  }
});

// Get user's following
router.get('/users/:userId/following', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.userId);
    const followersCollection = await followers();
    const usersCollection = await users();

    const followingList = await followersCollection
      .find({ followerId: userId })
      .toArray();

    const followingWithDetails = await Promise.all(
      followingList.map(async (follow) => {
        const user = await usersCollection.findOne(
          { _id: follow.followingId },
          { projection: { password: 0 } }
        );
        return {
          id: user._id,
          name: user.name,
          followingSince: follow.createdAt,
        };
      })
    );

    res.json({ success: true, data: followingWithDetails });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ success: false, message: 'Failed to get following users' });
  }
});

module.exports = router; 
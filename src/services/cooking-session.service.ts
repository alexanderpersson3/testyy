import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db';
import {
  CookingSession,
  CookingSessionComment,
  CookingSessionLike,
  CookingSessionWithUser,
  CreateCookingSessionDto,
  UpdateCookingSessionDto,
  CookingSessionFeedParams
} from '../types/cooking-session';
import { WebSocketService } from './websocket-service';
import { ChallengeService } from './challenge.service';

export class CookingSessionService {
  constructor(
    private wsService: WebSocketService,
    private challengeService: ChallengeService
  ) {}

  /**
   * Create a new cooking session
   */
  async createSession(userId: string, data: CreateCookingSessionDto): Promise<ObjectId> {
    const db = await connectToDatabase();

    const session: Omit<CookingSession, '_id'> = {
      userId: new ObjectId(userId),
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      photos: data.photos || [],
      visibility: data.visibility || 'public',
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<CookingSession>('cooking_sessions').insertOne(session);

    // Notify followers
    this.wsService.broadcast(JSON.stringify({
      type: 'new_cooking_session',
      sessionId: result.insertedId.toString(),
      userId
    }));

    // Process challenges
    const createdSession = { ...session, _id: result.insertedId };
    await this.challengeService.processCookingSession(createdSession);

    return result.insertedId;
  }

  /**
   * Get a cooking session by ID
   */
  async getSession(sessionId: string, currentUserId?: string): Promise<CookingSessionWithUser | null> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').aggregate([
      { $match: { _id: new ObjectId(sessionId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          startTime: 1,
          endTime: 1,
          photos: 1,
          visibility: 1,
          likeCount: 1,
          commentCount: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: 1,
            name: 1,
            avatar: 1
          }
        }
      }
    ]).next() as unknown as CookingSessionWithUser;

    if (!session) return null;

    // Check if current user has liked the session
    if (currentUserId) {
      const like = await db.collection<CookingSessionLike>('cooking_session_likes').findOne({
        sessionId: new ObjectId(sessionId),
        userId: new ObjectId(currentUserId)
      });
      session.isLiked = !!like;
    }

    return session;
  }

  /**
   * Get cooking session feed
   */
  async getFeed(params: CookingSessionFeedParams, currentUserId?: string): Promise<CookingSessionWithUser[]> {
    const db = await connectToDatabase();
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    const query: any = {};

    if (params.userId) {
      query.userId = new ObjectId(params.userId);
    }

    if (params.following && currentUserId) {
      const following = await db.collection('follows').find({
        followerId: new ObjectId(currentUserId)
      }).toArray();
      query.userId = { $in: following.map(f => f.followingId) };
    }

    if (params.visibility) {
      query.visibility = params.visibility;
    } else if (currentUserId) {
      // If not specified, show public and followed users' posts
      const following = await db.collection('follows').find({
        followerId: new ObjectId(currentUserId)
      }).toArray();
      query.$or = [
        { visibility: 'public' },
        {
          $and: [
            { visibility: 'followers' },
            { userId: { $in: following.map(f => f.followingId) } }
          ]
        },
        {
          $and: [
            { visibility: 'private' },
            { userId: new ObjectId(currentUserId) }
          ]
        }
      ];
    } else {
      query.visibility = 'public';
    }

    const sessions = await db.collection<CookingSession>('cooking_sessions').aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          startTime: 1,
          endTime: 1,
          photos: 1,
          visibility: 1,
          likeCount: 1,
          commentCount: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: 1,
            name: 1,
            avatar: 1
          }
        }
      }
    ]).toArray() as unknown as CookingSessionWithUser[];

    // Check which sessions the current user has liked
    if (currentUserId && sessions.length > 0) {
      const sessionIds = sessions.map(s => s._id!);  // We know _id exists from the aggregation
      const likes = await db.collection<CookingSessionLike>('cooking_session_likes')
        .find({
          sessionId: { $in: sessionIds },
          userId: new ObjectId(currentUserId)
        })
        .toArray();

      const likedSessionIds = new Set(likes.map(l => l.sessionId.toString()));
      sessions.forEach(session => {
        session.isLiked = likedSessionIds.has(session._id!.toString());
      });
    }

    return sessions;
  }

  /**
   * Update a cooking session
   */
  async updateSession(sessionId: string, userId: string, data: UpdateCookingSessionDto): Promise<void> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(userId)
    });

    if (!session) {
      throw new Error('Session not found or user not authorized');
    }

    const update: any = {
      $set: {
        ...data,
        updatedAt: new Date()
      }
    };

    await db.collection<CookingSession>('cooking_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      update
    );
  }

  /**
   * Delete a cooking session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').findOne({
      _id: new ObjectId(sessionId),
      userId: new ObjectId(userId)
    });

    if (!session) {
      throw new Error('Session not found or user not authorized');
    }

    await db.collection<CookingSession>('cooking_sessions').deleteOne({
      _id: new ObjectId(sessionId)
    });

    // Clean up related data
    await Promise.all([
      db.collection<CookingSessionLike>('cooking_session_likes').deleteMany({
        sessionId: new ObjectId(sessionId)
      }),
      db.collection<CookingSessionComment>('cooking_session_comments').deleteMany({
        sessionId: new ObjectId(sessionId)
      })
    ]);
  }

  /**
   * Like a cooking session
   */
  async likeSession(sessionId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').findOne({
      _id: new ObjectId(sessionId)
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const existingLike = await db.collection<CookingSessionLike>('cooking_session_likes').findOne({
      sessionId: new ObjectId(sessionId),
      userId: new ObjectId(userId)
    });

    if (existingLike) {
      throw new Error('Session already liked');
    }

    await Promise.all([
      db.collection<CookingSessionLike>('cooking_session_likes').insertOne({
        sessionId: new ObjectId(sessionId),
        userId: new ObjectId(userId),
        createdAt: new Date()
      }),
      db.collection<CookingSession>('cooking_sessions').updateOne(
        { _id: new ObjectId(sessionId) },
        { $inc: { likeCount: 1 } }
      )
    ]);

    // Notify session owner
    if (!session.userId.equals(new ObjectId(userId))) {
      this.wsService.sendToUser(session.userId.toString(), JSON.stringify({
        type: 'session_liked',
        sessionId,
        userId
      }));
    }
  }

  /**
   * Unlike a cooking session
   */
  async unlikeSession(sessionId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').findOne({
      _id: new ObjectId(sessionId)
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const result = await db.collection<CookingSessionLike>('cooking_session_likes').deleteOne({
      sessionId: new ObjectId(sessionId),
      userId: new ObjectId(userId)
    });

    if (result.deletedCount > 0) {
      await db.collection<CookingSession>('cooking_sessions').updateOne(
        { _id: new ObjectId(sessionId) },
        { $inc: { likeCount: -1 } }
      );
    }
  }

  /**
   * Add a comment to a cooking session
   */
  async addComment(sessionId: string, userId: string, text: string): Promise<ObjectId> {
    const db = await connectToDatabase();

    const session = await db.collection<CookingSession>('cooking_sessions').findOne({
      _id: new ObjectId(sessionId)
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const comment: Omit<CookingSessionComment, '_id'> = {
      sessionId: new ObjectId(sessionId),
      userId: new ObjectId(userId),
      text,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<CookingSessionComment>('cooking_session_comments').insertOne(comment);

    await db.collection<CookingSession>('cooking_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { $inc: { commentCount: 1 } }
    );

    // Notify session owner
    if (!session.userId.equals(new ObjectId(userId))) {
      this.wsService.sendToUser(session.userId.toString(), JSON.stringify({
        type: 'session_commented',
        sessionId,
        userId,
        commentId: result.insertedId.toString()
      }));
    }

    return result.insertedId;
  }

  /**
   * Get comments for a cooking session
   */
  async getComments(sessionId: string, limit = 50, offset = 0): Promise<CookingSessionComment[]> {
    const db = await connectToDatabase();

    return await db.collection<CookingSessionComment>('cooking_session_comments')
      .find({ sessionId: new ObjectId(sessionId) })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }
} 

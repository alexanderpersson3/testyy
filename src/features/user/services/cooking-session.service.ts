;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import { CookingSession, CookingSessionComment, CookingSessionLike, CookingSessionParticipant, CookingSessionStatus, CookingSessionPhoto, CookingSessionInvite, CookingSessionFeedParams, StepProgress, TimerProgress, Visibility, CreateCookingSessionDTO, UpdateStepProgressDTO, UpdateTimerDTO, UpdateCookingSessionDTO,  } from '../types/cooking-session.js';;
import type { Recipe } from '../types/express.js';
import { User, UserFollowing } from '../types/user.js';;
import { WebSocketService } from '../websocket-service.js';;
import { NotificationManagerService } from '../notification-manager.service.js';;
import logger from '../utils/logger.js';

interface CreateSessionOptions {
  scheduledFor?: Date;
  maxParticipants?: number;
  isPrivate?: boolean;
}

export interface CookingSessionWithUser extends CookingSession {
  recipe: Recipe;
  host: {
    _id: ObjectId;
    name: string;
    avatar?: string;
  };
  isLiked?: boolean;
  likesCount: number;
}

export interface CookingSessionStats {
  totalSessions: number;
  completedSessions: number;
  averageRating: number;
  totalCookingTime: number;
  favoriteCuisines: string[];
}

export class CookingSessionService {
  private static instance: CookingSessionService | null = null;
  private wsService: WebSocketService;
  private notificationService: NotificationManagerService;
  private db: DatabaseService;
  private readonly COLLECTION = 'cooking_sessions';
  private readonly LIKES_COLLECTION = 'cooking_session_likes';
  private readonly INVITES_COLLECTION = 'cooking_session_invites';
  private readonly USERS_COLLECTION = 'users';
  private readonly RECIPES_COLLECTION = 'recipes';

  private constructor() {
    this.wsService = WebSocketService.getInstance();
    this.notificationService = NotificationManagerService.getInstance();
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): CookingSessionService {
    if (!CookingSessionService.instance) {
      CookingSessionService.instance = new CookingSessionService();
    }
    return CookingSessionService.instance;
  }

  private getSessionsCollection() {
    return this.db.getCollection<CookingSession>(this.COLLECTION);
  }

  private getLikesCollection() {
    return this.db.getCollection<CookingSessionLike>(this.LIKES_COLLECTION);
  }

  private getInvitesCollection() {
    return this.db.getCollection<CookingSessionInvite>(this.INVITES_COLLECTION);
  }

  private getUsersCollection() {
    return this.db.getCollection<User>(this.USERS_COLLECTION);
  }

  private getRecipesCollection() {
    return this.db.getCollection<Recipe>(this.RECIPES_COLLECTION);
  }

  private getFollowsCollection() {
    return this.db.getCollection<UserFollowing>('follows');
  }

  private broadcastToSession(sessionId: string | ObjectId, message: any) {
    this.wsService.broadcast('session_update', {
      channel: `session:${sessionId}`,
      ...message
    });
  }

  /**
   * Create a new cooking session
   */
  async createSession(
    recipeId: ObjectId,
    hostId: ObjectId,
    options: CreateSessionOptions = {}
  ): Promise<CookingSession> {
    const now = new Date();
    const session: CookingSession = {
      recipeId,
      status: 'waiting',
      participants: [
        {
          userId: hostId,
          role: 'host',
          joinedAt: now,
          completedSteps: [],
        },
      ],
      photos: [],
      comments: [],
      scheduledFor: options.scheduledFor,
      maxParticipants: options.maxParticipants,
      isPrivate: options.isPrivate ?? false,
      orientation: 'vertical',
      servings: 1,
      stepProgress: [],
      activeTimers: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.getSessionsCollection().insertOne(session);
    return { ...session, _id: result.insertedId };
  }

  /**
   * Join a cooking session
   */
  async joinSession(sessionId: ObjectId, userId: ObjectId): Promise<boolean> {
    const session = await this.getSessionsCollection().findOne({
      _id: sessionId,
      status: { $in: ['waiting', 'in_progress'] },
    });

    if (!session) {
      throw new Error('Session not found or not joinable');
    }

    if (session.maxParticipants && session.participants.length >= session.maxParticipants) {
      throw new Error('Session is full');
    }

    if (session.participants.some(p => p.userId.equals(userId))) {
      return true; // Already joined
    }

    const result = await this.getSessionsCollection().updateOne(
      { _id: sessionId },
      {
        $push: {
          participants: {
            userId,
            role: 'participant',
            joinedAt: new Date(),
            completedSteps: [],
          },
        },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount > 0) {
      this.broadcastToSession(sessionId, {
        type: 'participant_joined',
        data: {
          userId,
          timestamp: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Start a cooking session
   */
  async startSession(sessionId: ObjectId, hostId: ObjectId): Promise<boolean> {
    const result = await this.getSessionsCollection().updateOne(
      {
        _id: sessionId,
        status: 'waiting',
        participants: {
          $elemMatch: {
            userId: hostId,
            role: 'host',
          },
        },
      },
      {
        $set: {
          status: 'in_progress',
          startTime: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      this.broadcastToSession(sessionId, {
        type: 'session_started',
        data: {
          timestamp: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * End a cooking session
   */
  async endSession(sessionId: ObjectId, hostId: ObjectId): Promise<boolean> {
    const result = await this.getSessionsCollection().updateOne(
      {
        _id: sessionId,
        status: 'in_progress',
        participants: {
          $elemMatch: {
            userId: hostId,
            role: 'host',
          },
        },
      },
      {
        $set: {
          status: 'completed',
          endTime: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      this.broadcastToSession(sessionId, {
        type: 'session_ended',
        data: {
          timestamp: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Update participant's current step
   */
  async updateStep(
    sessionId: ObjectId,
    userId: ObjectId,
    stepNumber: number,
    completed: boolean
  ): Promise<boolean> {
    const update: any = {
      'participants.$.currentStep': stepNumber,
      updatedAt: new Date(),
    };

    if (completed) {
      update['$addToSet'] = {
        'participants.$.completedSteps': stepNumber,
      };
    }

    const result = await this.getSessionsCollection().updateOne(
      {
        _id: sessionId,
        status: 'in_progress',
        'participants.userId': userId,
      },
      { $set: update }
    );

    if (result.modifiedCount > 0) {
      this.broadcastToSession(sessionId, {
        type: 'step_updated',
        data: {
          userId,
          stepNumber,
          completed,
          timestamp: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Add a photo to the session
   */
  async addPhoto(
    sessionId: ObjectId,
    userId: ObjectId,
    imageUrl: string,
    options: {
      caption?: string;
      stepNumber?: number;
    } = {}
  ): Promise<CookingSessionPhoto> {
    const photo: CookingSessionPhoto = {
      _id: new ObjectId(),
      userId,
      imageUrl,
      caption: options.caption,
      stepNumber: options.stepNumber,
      createdAt: new Date(),
    };

    const result = await this.getSessionsCollection().updateOne(
      { _id: sessionId },
      {
        $push: { photos: photo },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to add photo to session');
    }

    this.broadcastToSession(sessionId, {
      type: 'photo_added',
      data: {
        photo,
        timestamp: new Date(),
      },
    });

    return photo;
  }

  /**
   * Add a comment to the session
   */
  async addComment(
    sessionId: ObjectId,
    userId: ObjectId,
    content: string,
    stepNumber?: number
  ): Promise<CookingSessionComment> {
    const comment: CookingSessionComment = {
      _id: new ObjectId(),
      userId,
      content,
      stepNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.getSessionsCollection().updateOne(
      { _id: sessionId },
      {
        $push: { comments: comment },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to add comment to session');
    }

    this.broadcastToSession(sessionId, {
      type: 'comment_added',
      data: {
        comment,
        timestamp: new Date(),
      },
    });

    return comment;
  }

  /**
   * Create an invite for a session
   */
  async createInvite(
    sessionId: ObjectId,
    invitedBy: ObjectId,
    email: string
  ): Promise<CookingSessionInvite> {
    const invite: CookingSessionInvite = {
      sessionId,
      invitedBy,
      email,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const result = await this.getInvitesCollection().insertOne(invite);
    return { ...invite, _id: result.insertedId };
  }

  /**
   * Accept an invite to join a session
   */
  async acceptInvite(inviteId: ObjectId, userId: ObjectId): Promise<boolean> {
    const invite = await this.getInvitesCollection().findOne({
      _id: inviteId,
      status: 'pending',
    });

    if (!invite) {
      throw new Error('Invite not found or already used');
    }

    if (invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    // Update invite status
    await this.getInvitesCollection().updateOne(
      { _id: inviteId },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      }
    );

    // Join the session
    return this.joinSession(invite.sessionId, userId);
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: ObjectId): Promise<CookingSession | null> {
    return this.getSessionsCollection().findOne({ _id: sessionId });
  }

  /**
   * List active sessions
   */
  async listActiveSessions(
    options: {
      limit?: number;
      offset?: number;
      includePrivate?: boolean;
    } = {}
  ): Promise<CookingSession[]> {
    const { limit = 20, offset = 0, includePrivate = false } = options;

    const query: any = {
      status: { $in: ['waiting', 'in_progress'] },
    };

    if (!includePrivate) {
      query.isPrivate = false;
    }

    return this.getSessionsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * Get session by ID with user details
   */
  async getSessionById(
    sessionId: string,
    currentUserId?: string
  ): Promise<CookingSessionWithUser | null> {
    const session = await this.getSessionsCollection().findOne({
      _id: new ObjectId(sessionId),
    });

    if (!session) {
      return null;
    }

    // Get recipe details
    const recipe = await this.getRecipesCollection().findOne({
      _id: session.recipeId,
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Get host details
    const host = session.participants.find(p => p.role === 'host');
    if (!host) {
      throw new Error('Host not found');
    }

    const hostUser = await this.getUsersCollection().findOne({
      _id: host.userId,
    });

    if (!hostUser) {
      throw new Error('Host user not found');
    }

    // Get likes count
    const likesCount = await this.getLikesCollection().countDocuments({
      sessionId: new ObjectId(sessionId),
    });

    // Check if current user liked the session
    let isLiked = false;
    if (currentUserId) {
      const like = await this.getLikesCollection().findOne({
        sessionId: new ObjectId(sessionId),
        userId: new ObjectId(currentUserId),
      });
      isLiked = !!like;
    }

    return {
      ...session,
      recipe,
      host: {
        _id: hostUser._id,
        name: hostUser.name,
        avatar: undefined, // Avatar is not part of the User type
      },
      isLiked,
      likesCount,
    };
  }

  /**
   * Get session feed
   */
  async getFeed(
    params: CookingSessionFeedParams,
    currentUserId?: string
  ): Promise<CookingSessionWithUser[]> {
    const { limit = 20, offset = 0, userId, following, visibility } = params;

    const query: any = {
      status: { $in: ['in_progress', 'completed'] },
    };

    if (userId) {
      query['participants.userId'] = new ObjectId(userId);
    }

    if (following && currentUserId) {
      const followedUsers = await this.getFollowsCollection()
        .find({
          followerId: new ObjectId(currentUserId),
        })
        .toArray();

      query['participants.userId'] = {
        $in: followedUsers.map(f => f.followingId),
      };
    }

    if (visibility) {
      if (visibility === 'private') {
        query.isPrivate = true;
      } else if (visibility === 'public') {
        query.isPrivate = false;
      }
    }

    const sessions = await this.getSessionsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Enrich sessions with additional data
    const enrichedSessions = await Promise.all(
      sessions.map(async session => {
        const recipe = await this.getRecipesCollection().findOne({
          _id: session.recipeId,
        });

        if (!recipe) {
          throw new Error(`Recipe not found for session ${session._id}`);
        }

        const host = session.participants.find(p => p.role === 'host');
        if (!host) {
          throw new Error(`Host not found for session ${session._id}`);
        }

        const hostUser = await this.getUsersCollection().findOne({
          _id: host.userId,
        });

        if (!hostUser) {
          throw new Error(`Host user not found for session ${session._id}`);
        }

        const likesCount = await this.getLikesCollection().countDocuments({
          sessionId: session._id,
        });

        let isLiked = false;
        if (currentUserId) {
          const like = await this.getLikesCollection().findOne({
            sessionId: session._id,
            userId: new ObjectId(currentUserId),
          });
          isLiked = !!like;
        }

        return {
          ...session,
          recipe,
          host: {
            _id: hostUser._id,
            name: hostUser.name,
            avatar: undefined, // Avatar is not part of the User type
          },
          isLiked,
          likesCount,
        };
      })
    );

    return enrichedSessions;
  }

  /**
   * Update session details
   */
  async updateSession(
    sessionId: string,
    userId: string,
    data: UpdateCookingSessionDTO
  ): Promise<void> {
    const result = await this.getSessionsCollection().updateOne(
      {
        _id: new ObjectId(sessionId),
        participants: {
          $elemMatch: {
            userId: new ObjectId(userId),
            role: 'host',
          },
        },
      },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to update session or user is not the host');
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const result = await this.getSessionsCollection().deleteOne({
      _id: new ObjectId(sessionId),
      participants: {
        $elemMatch: {
          userId: new ObjectId(userId),
          role: 'host',
        },
      },
    });

    if (result.deletedCount === 0) {
      throw new Error('Failed to delete session or user is not the host');
    }
  }

  /**
   * Like a session
   */
  async likeSession(sessionId: string, userId: string): Promise<void> {
    const like: CookingSessionLike = {
      sessionId: new ObjectId(sessionId),
      userId: new ObjectId(userId),
      createdAt: new Date(),
    };

    try {
      await this.getLikesCollection().insertOne(like);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error
        return; // Already liked
      }
      throw error;
    }

    this.broadcastToSession(sessionId, {
      type: 'session_liked',
      data: {
        userId,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Unlike a session
   */
  async unlikeSession(sessionId: string, userId: string): Promise<void> {
    const result = await this.getLikesCollection().deleteOne({
      sessionId: new ObjectId(sessionId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount > 0) {
      this.broadcastToSession(sessionId, {
        type: 'session_unliked',
        data: {
          userId,
          timestamp: new Date(),
        },
      });
    }
  }

  /**
   * Get session comments
   */
  async getComments(sessionId: string, limit = 50, offset = 0): Promise<CookingSessionComment[]> {
    const session = await this.getSessionsCollection().findOne(
      { _id: new ObjectId(sessionId) },
      { projection: { comments: { $slice: [offset, limit] } } }
    );

    return session?.comments || [];
  }

  /**
   * Start a new cooking session
   */
  async initiateSession(userId: string, data: CreateCookingSessionDTO): Promise<ObjectId> {
    // Get recipe details
    const recipe = await this.getRecipesCollection().findOne({
      _id: new ObjectId(data.recipeId),
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const stepProgress: StepProgress[] = recipe.instructions.map((_, idx: number) => ({
      stepIndex: idx,
      isCompleted: false,
    }));

    const activeTimers: TimerProgress[] = [];

    const session: Omit<CookingSession, '_id'> = {
      recipeId: new ObjectId(data.recipeId),
      participants: [
        {
          userId: new ObjectId(userId),
          role: 'host',
          joinedAt: new Date(),
          completedSteps: [],
        },
      ],
      status: 'waiting',
      photos: [],
      comments: [],
      scheduledFor: data.scheduledFor,
      maxParticipants: data.maxParticipants,
      orientation: data.orientation || 'vertical',
      servings: data.servings,
      stepProgress,
      activeTimers,
      isPrivate: data.visibility === 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.getSessionsCollection().insertOne(session);
    return result.insertedId;
  }

  /**
   * Update step progress
   */
  async updateStepProgress(
    sessionId: string,
    userId: string,
    stepIndex: number,
    data: UpdateStepProgressDTO
  ): Promise<void> {
    const session = await this.getSessionsCollection().findOne({
      _id: new ObjectId(sessionId),
      status: 'in_progress',
    });

    if (!session) {
      throw new Error('Session not found or not in progress');
    }

    const participant = session.participants.find(p => p.userId.equals(new ObjectId(userId)));

    if (!participant) {
      throw new Error('User is not a participant in this session');
    }

    const update: any = {
      [`stepProgress.${stepIndex}`]: {
        stepIndex,
        isCompleted: data.isCompleted,
        startedAt: data.startedAt || new Date(),
        completedAt: data.isCompleted ? new Date() : undefined,
        notes: data.notes,
      },
      updatedAt: new Date(),
    };

    if (data.isCompleted) {
      update['$addToSet'] = {
        'participants.$.completedSteps': stepIndex,
      };
    }

    const result = await this.getSessionsCollection().updateOne(
      {
        _id: new ObjectId(sessionId),
        'participants.userId': new ObjectId(userId),
      },
      { $set: update }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to update step progress');
    }

    this.broadcastToSession(sessionId, {
      type: 'step_progress_updated',
      data: {
        userId,
        stepIndex,
        progress: data,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Update timer status
   */
  async updateTimer(
    sessionId: string,
    userId: string,
    stepIndex: number,
    timerId: string,
    data: UpdateTimerDTO
  ): Promise<void> {
    const session = await this.getSessionsCollection().findOne({
      _id: new ObjectId(sessionId),
      'participants.userId': new ObjectId(userId),
      status: { $in: ['waiting', 'in_progress'] },
    });

    if (!session) {
      throw new Error('Session not found or not active');
    }

    const now = new Date();
    const timer = session.activeTimers.find((t: { timerId: string }) => t.timerId === timerId);

    switch (data.action) {
      case 'start':
        if (timer) {
          throw new Error('Timer already exists');
        }
        await this.getSessionsCollection().updateOne(
          { _id: new ObjectId(sessionId) },
          {
            $push: {
              activeTimers: {
                stepIndex,
                timerId,
                startedAt: now,
                remainingSeconds: data.remainingSeconds || 0,
              },
            },
          }
        );
        break;

      case 'pause':
        if (!timer) {
          throw new Error('Timer not found');
        }
        await this.getSessionsCollection().updateOne(
          { _id: new ObjectId(sessionId), 'activeTimers.timerId': timerId },
          {
            $set: {
              'activeTimers.$.pausedAt': now,
              'activeTimers.$.remainingSeconds': data.remainingSeconds || 0,
            },
          }
        );
        break;

      case 'resume':
        if (!timer) {
          throw new Error('Timer not found');
        }
        await this.getSessionsCollection().updateOne(
          { _id: new ObjectId(sessionId), 'activeTimers.timerId': timerId },
          {
            $unset: { 'activeTimers.$.pausedAt': '' },
            $set: {
              'activeTimers.$.remainingSeconds': data.remainingSeconds || 0,
            },
          }
        );
        break;

      case 'stop':
        if (!timer) {
          throw new Error('Timer not found');
        }
        await this.getSessionsCollection().updateOne(
          { _id: new ObjectId(sessionId) },
          {
            $pull: { activeTimers: { timerId } },
          }
        );
        break;
    }

    await this.getSessionsCollection().updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { lastActiveAt: now } }
    );
  }

  /**
   * Complete a cooking session
   */
  private async completeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSessionsCollection().findOne({
      _id: new ObjectId(sessionId),
      participants: {
        $elemMatch: {
          userId: new ObjectId(userId),
          role: 'host',
        },
      },
    });

    if (!session) {
      throw new Error('Session not found or user not authorized');
    }

    const now = new Date();
    const totalTimeSpent = session.startTime
      ? Math.floor((now.getTime() - session.startTime.getTime()) / 1000)
      : 0;

    await this.getSessionsCollection().updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          status: 'completed',
          endTime: now,
          totalTimeSpent,
          updatedAt: now,
        },
      }
    );
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<CookingSessionStats> {
    const sessions = await this.getSessionsCollection()
      .find({
        'participants.userId': new ObjectId(userId),
      })
      .toArray();

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const totalCookingTime = sessions.reduce((total: any, s: any) => {
      if (s.startTime && s.endTime) {
        return total + (s.endTime.getTime() - s.startTime.getTime());
      }
      return total;
    }, 0);

    // Calculate favorite cuisines
    const cuisineCounts = new Map<string, number>();
    for (const session of sessions) {
      const recipe = await this.getRecipesCollection().findOne({
        _id: session.recipeId,
      });
      if (recipe?.cuisine) {
        cuisineCounts.set(recipe.cuisine, (cuisineCounts.get(recipe.cuisine) || 0) + 1);
      }
    }

    const favoriteCuisines = Array.from(cuisineCounts.entries())
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    return {
      totalSessions,
      completedSessions,
      averageRating: 0, // TODO: Implement ratings
      totalCookingTime: Math.floor(totalCookingTime / (1000 * 60)), // Convert to minutes
      favoriteCuisines,
    };
  }
}

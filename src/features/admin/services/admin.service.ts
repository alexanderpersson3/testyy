import { ObjectId, Document } from 'mongodb';
import { DatabaseService } from '../../../core/database/database.service.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import { AuditLogType, AdminAction, SystemStats, AuditLog, AdminSettings } from '../types/admin.types.js';

interface User extends Document {
  _id: ObjectId;
  status: string;
  role: string;
}

interface Content extends Document {
  _id: ObjectId;
  status: string;
}

interface Report extends Document {
  _id: ObjectId;
  targetId: string;
  targetType: string;
  reason: string;
  status: string;
}

interface BlockedIP extends Document {
  ip: string;
  reason: string;
  blockedAt: Date;
}

interface Token extends Document {
  userId: ObjectId;
  id: string;
  createdAt: Date;
  lastUsed: Date;
}

interface Settings extends Document {
  content: {
    guidelines: string[];
  };
}

export class AdminService {
  private readonly collections = {
    users: 'users',
    recipes: 'recipes',
    comments: 'comments',
    reports: 'reports',
    auditLogs: 'audit_logs',
    settings: 'admin_settings',
    tokens: 'tokens',
    blockedIPs: 'blocked_ips'
  };

  constructor(private readonly db: DatabaseService) {}

  // User Management
  async blockUser(userId: ObjectId, reason: string): Promise<void> {
    const user = await this.db.getCollection<User>(this.collections.users).findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.db.getCollection<User>(this.collections.users).updateOne(
      { _id: userId },
      {
        $set: {
          status: 'blocked',
          blockedReason: reason,
          blockedAt: new Date()
        }
      }
    );

    await this.createAuditLog({
      type: 'user_blocked',
      action: 'user_management',
      targetId: userId,
      targetType: 'user',
      changes: {
        before: { status: user.status },
        after: { status: 'blocked', reason }
      }
    });
  }

  async unblockUser(userId: ObjectId): Promise<void> {
    const user = await this.db.getCollection<User>(this.collections.users).findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.db.getCollection<User>(this.collections.users).updateOne(
      { _id: userId },
      {
        $set: { status: 'active' },
        $unset: { blockedReason: '', blockedAt: '' }
      }
    );

    await this.createAuditLog({
      type: 'user_unblocked',
      action: 'user_management',
      targetId: userId,
      targetType: 'user',
      changes: {
        before: { status: user.status },
        after: { status: 'active' }
      }
    });
  }

  async updateUserRole(userId: ObjectId, role: string): Promise<void> {
    const user = await this.db.getCollection<User>(this.collections.users).findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.db.getCollection<User>(this.collections.users).updateOne(
      { _id: userId },
      { $set: { role } }
    );

    await this.createAuditLog({
      type: 'role_updated',
      action: 'user_management',
      targetId: userId,
      targetType: 'user',
      changes: {
        before: { role: user.role },
        after: { role }
      }
    });
  }

  async deleteUser(userId: ObjectId): Promise<void> {
    const user = await this.db.getCollection(this.collections.users).findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Soft delete user and their content
    await Promise.all([
      this.db.getCollection(this.collections.users).updateOne(
        { _id: userId },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      ),
      this.db.getCollection(this.collections.recipes).updateMany(
        { 'author._id': userId },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      ),
      this.db.getCollection(this.collections.comments).updateMany(
        { userId },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      )
    ]);

    await this.createAuditLog({
      type: 'user_deleted',
      action: 'user_management',
      targetId: userId,
      targetType: 'user',
    });
  }

  async exportUserData(userId: ObjectId): Promise<Record<string, unknown>> {
    const user = await this.db.getCollection(this.collections.users).findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const [recipes, comments, likes, follows] = await Promise.all([
      this.db.getCollection(this.collections.recipes).find({ 'author._id': userId }).toArray(),
      this.db.getCollection(this.collections.comments).find({ userId }).toArray(),
      this.db.getCollection('recipe_likes').find({ userId }).toArray(),
      this.db.getCollection('follows').find({ 
        $or: [{ followerId: userId }, { followedId: userId }]
      }).toArray()
    ]);

    await this.createAuditLog({
      type: 'data_exported',
      action: 'data_management',
      targetId: userId,
      targetType: 'user',
    });

    return {
      user: {
        ...user,
        password: undefined
      },
      content: {
        recipes,
        comments,
        likes,
        follows
      }
    };
  }

  // Content Moderation
  async removeContent(contentId: ObjectId, contentType: string, reason: string): Promise<void> {
    const collectionName = this.getCollectionForContentType(contentType);
    const content = await this.db.getCollection<Content>(collectionName).findOne({ _id: contentId });
    if (!content) {
      throw new NotFoundError(`${contentType} not found`);
    }

    await this.db.getCollection<Content>(collectionName).updateOne(
      { _id: contentId },
      {
        $set: {
          status: 'removed',
          removedReason: reason,
          removedAt: new Date()
        }
      }
    );

    await this.createAuditLog({
      type: 'content_removed',
      action: 'content_moderation',
      targetId: contentId,
      targetType: contentType,
      changes: {
        before: { status: content.status },
        after: { status: 'removed', reason }
      }
    });
  }

  async restoreContent(contentId: ObjectId, contentType: string): Promise<void> {
    const collection = this.db.getCollection(this.getCollectionForContentType(contentType));
    const content = await this.db.getCollection(collection).findOne({ _id: contentId });
    if (!content) {
      throw new NotFoundError(`${contentType} not found`);
    }

    await this.db.getCollection(collection).updateOne(
      { _id: contentId },
      { 
        $set: { status: 'active' },
        $unset: { removedReason: '', removedAt: '' }
      }
    );

    await this.createAuditLog({
      type: 'content_restored',
      action: 'content_moderation',
      targetId: contentId,
      targetType: contentType,
    });
  }

  async reviewReport(reportId: ObjectId, action: 'approve' | 'reject'): Promise<void> {
    const report = await this.db.getCollection<Report>(this.collections.reports).findOne({ _id: reportId });
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    await this.db.getCollection<Report>(this.collections.reports).updateOne(
      { _id: reportId },
      {
        $set: {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedAt: new Date()
        }
      }
    );

    if (action === 'approve') {
      await this.removeContent(
        new ObjectId(report.targetId),
        report.targetType,
        report.reason
      );
    }

    await this.createAuditLog({
      type: 'report_reviewed',
      action: 'content_moderation',
      targetId: reportId,
      targetType: 'report',
      changes: {
        before: { status: report.status },
        after: { status: action === 'approve' ? 'approved' : 'rejected' }
      }
    });
  }

  async updateContentGuidelines(guidelines: string[]): Promise<void> {
    const settings = await this.db.getCollection<Settings>(this.collections.settings).findOne({});
    
    await this.db.getCollection<Settings>(this.collections.settings).updateOne(
      {},
      { 
        $set: { 
          'content.guidelines': guidelines 
        }
      },
      { upsert: true }
    );

    await this.createAuditLog({
      type: 'guidelines_updated',
      action: 'content_moderation',
      targetId: new ObjectId(),
      targetType: 'settings',
      changes: {
        before: { guidelines: settings?.content?.guidelines || [] },
        after: { guidelines }
      }
    });
  }

  // System Configuration
  async getSystemStats(): Promise<SystemStats> {
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      newLastWeek,
      totalRecipes,
      totalComments,
      totalReports,
      activeTokens,
      blockedIPs
    ] = await Promise.all([
      this.db.getCollection<User>(this.collections.users).countDocuments(),
      this.db.getCollection<User>(this.collections.users).countDocuments({ status: 'active' }),
      this.db.getCollection<User>(this.collections.users).countDocuments({ status: 'blocked' }),
      this.db.getCollection<User>(this.collections.users).countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      this.db.getCollection<Content>(this.collections.recipes).countDocuments(),
      this.db.getCollection<Content>(this.collections.comments).countDocuments(),
      this.db.getCollection<Report>(this.collections.reports).countDocuments(),
      this.db.getCollection<Token>(this.collections.tokens).countDocuments({ status: 'active' }),
      this.db.getCollection<BlockedIP>(this.collections.blockedIPs).countDocuments()
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, blocked: blockedUsers, newLastWeek },
      content: { recipes: totalRecipes, comments: totalComments, reports: totalReports },
      security: { activeTokens, blockedIPs }
    };
  }

  async createBackup(): Promise<{ id: string; url: string }> {
    // Implementation depends on backup strategy (e.g., MongoDB dump, cloud storage)
    throw new Error('Not implemented');
  }

  async restoreBackup(backupId: string): Promise<void> {
    // Implementation depends on backup strategy
    throw new Error('Not implemented');
  }

  // Security Management
  async getAuditLogs(query: {
    type?: AuditLogType[];
    adminId?: ObjectId;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const filter: any = {};
    if (query.type) {
      filter.type = { $in: query.type };
    }
    if (query.adminId) {
      filter.adminId = query.adminId;
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = query.startDate;
      if (query.endDate) filter.createdAt.$lte = query.endDate;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.db
        .getCollection<AuditLog>(this.collections.auditLogs)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.db.getCollection<AuditLog>(this.collections.auditLogs).countDocuments(filter)
    ]);

    return { logs, total };
  }

  async getActiveTokens(): Promise<{
    userId: ObjectId;
    tokens: { id: string; createdAt: Date; lastUsed: Date }[];
  }[]> {
    const tokens = await this.db
      .getCollection<Token>(this.collections.tokens)
      .aggregate([
        { $match: { expiresAt: { $gt: new Date() } } },
        {
          $group: {
            _id: '$userId',
            tokens: {
              $push: {
                id: '$_id',
                createdAt: '$createdAt',
                lastUsed: '$lastUsed'
              }
            }
          }
        },
        {
          $project: {
            userId: '$_id',
            tokens: 1,
            _id: 0
          }
        }
      ])
      .toArray();

    return tokens.map(t => ({
      userId: t.userId,
      tokens: t.tokens
    }));
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.db.getCollection(this.collections.tokens).deleteOne({
      _id: new ObjectId(tokenId)
    });
  }

  async getBlockedIPs(): Promise<{ ip: string; reason: string; blockedAt: Date }[]> {
    const ips = await this.db
      .getCollection<BlockedIP>(this.collections.blockedIPs)
      .find()
      .sort({ blockedAt: -1 })
      .toArray();
    
    return ips.map(ip => ({
      ip: ip.ip,
      reason: ip.reason,
      blockedAt: ip.blockedAt
    }));
  }

  async unblockIP(ip: string): Promise<void> {
    await this.db.getCollection(this.collections.blockedIPs).deleteOne({ ip });
  }

  // Private helpers
  private getCollectionForContentType(type: string): string {
    switch (type) {
      case 'recipe':
        return this.collections.recipes;
      case 'comment':
        return this.collections.comments;
      case 'article':
        return this.collections.recipes;
      default:
        throw new ValidationError('Invalid content type', [{ field: 'contentType', message: 'Invalid content type' }]);
    }
  }

  private async createAuditLog(data: {
    type: string;
    action: string;
    targetId: ObjectId;
    targetType: string;
    changes: {
      before: Record<string, any>;
      after: Record<string, any>;
    };
  }): Promise<void> {
    const log = {
      _id: new ObjectId(),
      ...data,
      adminId: new ObjectId(), // TODO: Get from context
      ip: '', // TODO: Get from request
      userAgent: '', // TODO: Get from request
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.getCollection<AuditLog>(this.collections.auditLogs).insertOne(log);
  }
}

// Export singleton instance
export const adminService = new AdminService(DatabaseService.getInstance()); 
import { ObjectId } from 'mongodb';
import { AdminService } from '../services/admin.service.js';
import { DatabaseService } from '../../../core/database/database.service.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import { AuditLogType, AdminAction } from '../types/admin.types.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock DatabaseService
jest.mock('../../../core/database/database.service', () => ({
  DatabaseService: {
    getInstance: jest.fn().mockReturnValue({
      getCollection: jest.fn()
    })
  }
}), { virtual: true });

describe('AdminService', () => {
  let adminService: AdminService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn().mockReturnThis(),
    };

    mockDb = {
      getCollection: jest.fn().mockReturnValue(mockCollection),
    } as any;

    adminService = new AdminService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User Management', () => {
    describe('blockUser', () => {
      it('should block a user successfully', async () => {
        const userId = new ObjectId();
        const reason = 'Violation of terms';
        const mockUser = { _id: userId, status: 'active' };

        mockCollection.findOne.mockResolvedValueOnce(mockUser);
        mockCollection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await adminService.blockUser(userId, reason);

        expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: userId });
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: userId },
          {
            $set: {
              status: 'blocked',
              blockedReason: reason,
              blockedAt: expect.any(Date)
            }
          }
        );
      });

      it('should throw NotFoundError if user does not exist', async () => {
        const userId = new ObjectId();
        mockCollection.findOne.mockResolvedValueOnce(null);

        await expect(adminService.blockUser(userId, 'reason'))
          .rejects
          .toThrow(NotFoundError);
      });
    });

    describe('unblockUser', () => {
      it('should unblock a user successfully', async () => {
        const userId = new ObjectId();
        const mockUser = { _id: userId, status: 'blocked' };

        mockCollection.findOne.mockResolvedValueOnce(mockUser);
        mockCollection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await adminService.unblockUser(userId);

        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: userId },
          {
            $set: { status: 'active' },
            $unset: { blockedReason: '', blockedAt: '' }
          }
        );
      });
    });

    describe('updateUserRole', () => {
      it('should update user role successfully', async () => {
        const userId = new ObjectId();
        const newRole = 'moderator';
        const mockUser = { _id: userId, role: 'user' };

        mockCollection.findOne.mockResolvedValueOnce(mockUser);
        mockCollection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await adminService.updateUserRole(userId, newRole);

        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: userId },
          { $set: { role: newRole } }
        );
      });
    });
  });

  describe('Content Moderation', () => {
    describe('removeContent', () => {
      it('should remove content successfully', async () => {
        const contentId = new ObjectId();
        const contentType = 'recipe';
        const reason = 'Inappropriate content';
        const mockContent = { _id: contentId };

        mockCollection.findOne.mockResolvedValueOnce(mockContent);
        mockCollection.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await adminService.removeContent(contentId, contentType, reason);

        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: contentId },
          {
            $set: {
              status: 'removed',
              removedReason: reason,
              removedAt: expect.any(Date)
            }
          }
        );
      });
    });

    describe('reviewReport', () => {
      it('should approve a report and remove content', async () => {
        const reportId = new ObjectId();
        const mockReport = {
          _id: reportId,
          targetId: new ObjectId(),
          targetType: 'recipe',
          reason: 'spam'
        };

        mockCollection.findOne
          .mockResolvedValueOnce(mockReport)  // For report
          .mockResolvedValueOnce({ _id: mockReport.targetId });  // For content

        await adminService.reviewReport(reportId, 'approve');

        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: reportId },
          {
            $set: {
              status: 'approved',
              reviewedAt: expect.any(Date)
            }
          }
        );
      });
    });
  });

  describe('System Configuration', () => {
    describe('getSystemStats', () => {
      it('should return system statistics', async () => {
        const mockStats = {
          users: { total: 100, active: 80, blocked: 20, newLastWeek: 10 },
          content: { recipes: 500, comments: 1000, reports: 50 },
          security: { failedLogins: 5, activeTokens: 100, blockedIPs: 3 }
        };

        mockCollection.countDocuments
          .mockResolvedValueOnce(mockStats.users.total)
          .mockResolvedValueOnce(mockStats.users.active)
          .mockResolvedValueOnce(mockStats.users.blocked)
          .mockResolvedValueOnce(mockStats.users.newLastWeek)
          .mockResolvedValueOnce(mockStats.content.recipes)
          .mockResolvedValueOnce(mockStats.content.comments)
          .mockResolvedValueOnce(mockStats.content.reports)
          .mockResolvedValueOnce(mockStats.security.activeTokens)
          .mockResolvedValueOnce(mockStats.security.blockedIPs);

        const stats = await adminService.getSystemStats();

        expect(stats).toMatchObject({
          users: expect.any(Object),
          content: expect.any(Object),
          system: expect.any(Object),
          security: expect.any(Object)
        });
      });
    });
  });

  describe('Security Management', () => {
    describe('getAuditLogs', () => {
      it('should return filtered audit logs', async () => {
        const mockLogs = [
          {
            _id: new ObjectId(),
            type: AuditLogType.UserBlocked,
            action: AdminAction.UserManagement,
            createdAt: new Date()
          }
        ];

        const query = {
          type: [AuditLogType.UserBlocked],
          page: 1,
          limit: 10
        };

        mockCollection.find.mockReturnThis();
        mockCollection.sort.mockReturnThis();
        mockCollection.toArray.mockResolvedValueOnce(mockLogs);
        mockCollection.countDocuments.mockResolvedValueOnce(1);

        const result = await adminService.getAuditLogs(query);

        expect(result).toEqual({
          logs: mockLogs,
          total: 1
        });
      });
    });

    describe('getBlockedIPs', () => {
      it('should return list of blocked IPs', async () => {
        const mockBlockedIPs = [
          {
            ip: '192.168.1.1',
            reason: 'Too many failed attempts',
            blockedAt: new Date()
          }
        ];

        mockCollection.find.mockReturnThis();
        mockCollection.sort.mockReturnThis();
        mockCollection.toArray.mockResolvedValueOnce(mockBlockedIPs);

        const result = await adminService.getBlockedIPs();

        expect(result).toEqual(mockBlockedIPs);
      });
    });
  });
}); 
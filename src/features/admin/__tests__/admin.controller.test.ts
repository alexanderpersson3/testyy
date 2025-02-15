import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { AdminController } from '../controllers/admin.controller.js';
import { adminService } from '../services/admin.service.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock adminService
jest.mock('../services/admin.service', () => ({
  adminService: {
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
    exportUserData: jest.fn(),
    removeContent: jest.fn(),
    restoreContent: jest.fn(),
    reviewReport: jest.fn(),
    updateContentGuidelines: jest.fn(),
    updateSettings: jest.fn(),
    getSystemStats: jest.fn(),
    createBackup: jest.fn(),
    restoreBackup: jest.fn(),
    getAuditLogs: jest.fn(),
    getActiveTokens: jest.fn(),
    revokeToken: jest.fn(),
    getBlockedIPs: jest.fn(),
    unblockIP: jest.fn()
  }
}), { virtual: true });

describe('AdminController', () => {
  let controller: AdminController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    mockSend = jest.fn().mockReturnThis();
    mockResponse = {
      json: mockJson as any,
      status: mockStatus as any,
      send: mockSend as any
    };
    controller = new AdminController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User Management', () => {
    describe('blockUser', () => {
      it('should block user successfully', async () => {
        const userId = new ObjectId();
        mockRequest = {
          params: { id: userId.toString() },
          body: { reason: 'Violation of terms' }
        };

        await controller.blockUser(mockRequest as Request, mockResponse as Response);

        expect(adminService.blockUser).toHaveBeenCalledWith(
          expect.any(ObjectId),
          'Violation of terms'
        );
        expect(mockJson).toHaveBeenCalledWith({ success: true });
      });

      it('should handle NotFoundError', async () => {
        const userId = new ObjectId();
        mockRequest = {
          params: { id: userId.toString() },
          body: { reason: 'Violation of terms' }
        };

        (adminService.blockUser as jest.Mock<any>).mockRejectedValue(
          new NotFoundError('User not found')
        );

        await controller.blockUser(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'User not found'
        });
      });
    });

    describe('updateUserRole', () => {
      it('should update user role successfully', async () => {
        const userId = new ObjectId();
        mockRequest = {
          params: { id: userId.toString() },
          body: { role: 'moderator' }
        };

        await controller.updateUserRole(mockRequest as Request, mockResponse as Response);

        expect(adminService.updateUserRole).toHaveBeenCalledWith(
          expect.any(ObjectId),
          'moderator'
        );
        expect(mockJson).toHaveBeenCalledWith({ success: true });
      });
    });
  });

  describe('Content Moderation', () => {
    describe('removeContent', () => {
      it('should remove content successfully', async () => {
        const contentId = new ObjectId();
        mockRequest = {
          params: { id: contentId.toString() },
          body: {
            contentType: 'recipe',
            reason: 'Inappropriate content'
          }
        };

        await controller.removeContent(mockRequest as Request, mockResponse as Response);

        expect(adminService.removeContent).toHaveBeenCalledWith(
          expect.any(ObjectId),
          'recipe',
          'Inappropriate content'
        );
        expect(mockJson).toHaveBeenCalledWith({ success: true });
      });
    });

    describe('reviewReport', () => {
      it('should review report successfully', async () => {
        const reportId = new ObjectId();
        mockRequest = {
          params: { id: reportId.toString() },
          body: { action: 'approve' }
        };

        await controller.reviewReport(mockRequest as Request, mockResponse as Response);

        expect(adminService.reviewReport).toHaveBeenCalledWith(
          expect.any(ObjectId),
          'approve'
        );
        expect(mockJson).toHaveBeenCalledWith({ success: true });
      });
    });
  });

  describe('System Configuration', () => {
    describe('getSystemStats', () => {
      it('should return system statistics', async () => {
        const mockStats = {
          users: { total: 100, active: 80 },
          content: { recipes: 500, comments: 1000 }
        };

        (adminService.getSystemStats as jest.Mock<any>).mockResolvedValue(mockStats);

        await controller.getSystemStats(mockRequest as Request, mockResponse as Response);

        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: mockStats
        });
      });
    });
  });

  describe('Security Management', () => {
    describe('getAuditLogs', () => {
      it('should return filtered audit logs', async () => {
        const mockLogs = {
          logs: [{ type: 'user_blocked', timestamp: new Date() }],
          total: 1
        };

        (adminService.getAuditLogs as jest.Mock<any>).mockResolvedValue(mockLogs);

        await controller.getAuditLogs(mockRequest as Request, mockResponse as Response);

        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: mockLogs
        });
      });
    });

    describe('getBlockedIPs', () => {
      it('should return list of blocked IPs', async () => {
        const mockBlockedIPs = [
          { ip: '192.168.1.1', reason: 'Too many failed attempts' }
        ];

        (adminService.getBlockedIPs as jest.Mock<any>).mockResolvedValue(mockBlockedIPs);

        await controller.getBlockedIPs(mockRequest as Request, mockResponse as Response);

        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: mockBlockedIPs
        });
      });
    });
  });
}); 
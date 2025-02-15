import request from 'supertest';
import { ObjectId } from 'mongodb';
import { app } from '../../../app.js';
import { adminService } from '../services/admin.service.js';
import { generateToken } from '../../../core/utils/auth.utils.js';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

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

describe('Admin Routes', () => {
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;

  beforeAll(() => {
    adminToken = generateToken({ _id: new ObjectId(), role: 'admin' });
    moderatorToken = generateToken({ _id: new ObjectId(), role: 'moderator' });
    userToken = generateToken({ _id: new ObjectId(), role: 'user' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Management Routes', () => {
    describe('POST /users/:userId/block', () => {
      it('should block user when admin is authenticated', async () => {
        const userId = new ObjectId();
        const reason = 'Violation of terms';

        await request(app)
          .post(`/api/admin/users/${userId}/block`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason })
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(adminService.blockUser).toHaveBeenCalledWith(
              expect.any(ObjectId),
              reason
            );
          });
      });

      it('should reject when non-admin tries to block user', async () => {
        const userId = new ObjectId();
        
        await request(app)
          .post(`/api/admin/users/${userId}/block`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ reason: 'Violation' })
          .expect(403);
      });
    });

    describe('PUT /users/:userId/role', () => {
      it('should update user role when admin is authenticated', async () => {
        const userId = new ObjectId();
        const role = 'moderator';

        await request(app)
          .put(`/api/admin/users/${userId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role })
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(adminService.updateUserRole).toHaveBeenCalledWith(
              expect.any(ObjectId),
              role
            );
          });
      });
    });
  });

  describe('Content Moderation Routes', () => {
    describe('POST /content/:contentId/remove', () => {
      it('should remove content when admin is authenticated', async () => {
        const contentId = new ObjectId();
        const data = {
          contentType: 'recipe',
          reason: 'Copyright violation'
        };

        await request(app)
          .post(`/api/admin/content/${contentId}/remove`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(data)
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(adminService.removeContent).toHaveBeenCalledWith(
              expect.any(ObjectId),
              data.contentType,
              data.reason
            );
          });
      });

      it('should allow moderator to remove content', async () => {
        const contentId = new ObjectId();
        const data = {
          contentType: 'recipe',
          reason: 'Inappropriate content'
        };

        await request(app)
          .post(`/api/admin/content/${contentId}/remove`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send(data)
          .expect(200);
      });
    });

    describe('POST /reports/:reportId/review', () => {
      it('should review report when admin is authenticated', async () => {
        const reportId = new ObjectId();
        const action = 'approve';

        await request(app)
          .post(`/api/admin/reports/${reportId}/review`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ action })
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(adminService.reviewReport).toHaveBeenCalledWith(
              expect.any(ObjectId),
              action
            );
          });
      });
    });
  });

  describe('System Configuration Routes', () => {
    describe('GET /stats', () => {
      it('should return system stats when admin is authenticated', async () => {
        const mockStats = {
          users: { total: 100, active: 80 },
          content: { recipes: 500, comments: 1000 }
        };

        (adminService.getSystemStats as jest.Mock).mockResolvedValueOnce(mockStats);

        await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockStats);
          });
      });

      it('should reject when non-admin requests stats', async () => {
        await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });

  describe('Security Management Routes', () => {
    describe('GET /audit-logs', () => {
      it('should return audit logs when admin is authenticated', async () => {
        const mockLogs = {
          logs: [{ type: 'user_blocked', timestamp: new Date() }],
          total: 1
        };

        (adminService.getAuditLogs as jest.Mock).mockResolvedValueOnce(mockLogs);

        await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            type: 'user_blocked',
            page: '1',
            limit: '10'
          })
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockLogs);
          });
      });
    });

    describe('GET /blocked-ips', () => {
      it('should return blocked IPs when admin is authenticated', async () => {
        const mockBlockedIPs = [
          { ip: '192.168.1.1', reason: 'Too many failed attempts' }
        ];

        (adminService.getBlockedIPs as jest.Mock).mockResolvedValueOnce(mockBlockedIPs);

        await request(app)
          .get('/api/admin/blocked-ips')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockBlockedIPs);
          });
      });
    });
  });
}); 
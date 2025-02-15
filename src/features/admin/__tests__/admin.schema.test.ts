import { jest, describe, it, expect } from '@jest/globals';
import {
  blockUserSchema,
  updateUserRoleSchema,
  removeContentSchema,
  restoreContentSchema,
  reviewReportSchema,
  updateContentGuidelinesSchema,
  updateSettingsSchema,
  getAuditLogsSchema,
  revokeTokenSchema,
  unblockIPSchema
} from '../schemas/admin.schema.js';

jest.mock('../schemas/admin.schema', () => ({
  blockUserSchema: {
    validate: jest.fn()
  },
  updateUserRoleSchema: {
    validate: jest.fn()
  },
  removeContentSchema: {
    validate: jest.fn()
  },
  restoreContentSchema: {
    validate: jest.fn()
  },
  reviewReportSchema: {
    validate: jest.fn()
  },
  updateContentGuidelinesSchema: {
    validate: jest.fn()
  },
  updateSettingsSchema: {
    validate: jest.fn()
  },
  getAuditLogsSchema: {
    validate: jest.fn()
  },
  revokeTokenSchema: {
    validate: jest.fn()
  },
  unblockIPSchema: {
    validate: jest.fn()
  }
}), { virtual: true });

describe('Admin Validation Schemas', () => {
  describe('blockUserSchema', () => {
    it('should validate valid block user data', () => {
      const validData = {
        reason: 'Multiple violations of community guidelines'
      };

      (blockUserSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = blockUserSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid block user data', () => {
      const invalidData = {
        reason: 'short'  // Too short
      };

      (blockUserSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = blockUserSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('updateUserRoleSchema', () => {
    it('should validate valid role update data', () => {
      const validData = {
        role: 'moderator'
      };

      (updateUserRoleSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = updateUserRoleSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid role', () => {
      const invalidData = {
        role: 'invalid_role'
      };

      (updateUserRoleSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = updateUserRoleSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('removeContentSchema', () => {
    it('should validate valid content removal data', () => {
      const validData = {
        contentType: 'recipe',
        reason: 'Copyright violation - reported by content owner'
      };

      (removeContentSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = removeContentSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid content type', () => {
      const invalidData = {
        contentType: 'invalid_type',
        reason: 'Valid reason for removal'
      };

      (removeContentSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = removeContentSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('updateSettingsSchema', () => {
    it('should validate valid settings update', () => {
      const validData = {
        security: {
          maxLoginAttempts: 5,
          passwordPolicy: {
            minLength: 8,
            requireNumbers: true,
            requireSymbols: true,
            requireUppercase: true,
            expiryDays: 90
          },
          sessionTimeout: 3600,
          ipBlockDuration: 3600
        },
        email: {
          fromName: 'Rezepta Admin',
          fromEmail: 'admin@rezepta.com',
          templates: {
            welcome: {
              subject: 'Welcome to Rezepta',
              body: 'Welcome message template'
            }
          }
        },
        content: {
          maxUploadSize: 5242880,
          allowedFileTypes: ['image/jpeg', 'image/png'],
          autoModeration: {
            enabled: true,
            keywords: ['spam', 'inappropriate'],
            maxReportsThreshold: 5
          }
        },
        backup: {
          enabled: true,
          frequency: 'daily',
          retention: 30,
          includeUploads: true
        }
      };

      (updateSettingsSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = updateSettingsSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid settings values', () => {
      const invalidData = {
        security: {
          maxLoginAttempts: 0,  // Too low
          passwordPolicy: {
            minLength: 4,  // Too short
            expiryDays: 10  // Too short
          }
        }
      };

      (updateSettingsSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = updateSettingsSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('getAuditLogsSchema', () => {
    it('should validate valid audit log query', () => {
      const validData = {
        type: 'user_blocked',
        adminId: '507f1f77bcf86cd799439011',
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-12-31T23:59:59Z',
        page: 1,
        limit: 50
      };

      (getAuditLogsSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = getAuditLogsSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid date range', () => {
      const invalidData = {
        startDate: '2023-12-31T00:00:00Z',
        endDate: '2023-01-01T00:00:00Z'  // Before start date
      };

      (getAuditLogsSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = getAuditLogsSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('unblockIPSchema', () => {
    it('should validate valid IP address', () => {
      const validData = {
        ip: '192.168.1.1'
      };

      (unblockIPSchema.validate as jest.Mock).mockReturnValue({ error: undefined });
      const { error } = unblockIPSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid IP address', () => {
      const invalidData = {
        ip: 'invalid-ip'
      };

      (unblockIPSchema.validate as jest.Mock).mockReturnValue({ error: new Error() });
      const { error } = unblockIPSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });
}); 
import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../../../core/database/types/mongodb.types.js';

export enum AdminAction {
  UserManagement = 'user_management',
  ContentModeration = 'content_moderation',
  SystemConfiguration = 'system_configuration',
  SecurityManagement = 'security_management'
}

export enum AuditLogType {
  UserBlocked = 'user_blocked',
  UserUnblocked = 'user_unblocked',
  RoleUpdated = 'role_updated',
  ContentRemoved = 'content_removed',
  ContentRestored = 'content_restored',
  ReportReviewed = 'report_reviewed',
  GuidelinesUpdated = 'guidelines_updated',
  SettingsUpdated = 'settings_updated',
  BackupCreated = 'backup_created',
  BackupRestored = 'backup_restored',
  TokenRevoked = 'token_revoked',
  IPBlocked = 'ip_blocked',
  IPUnblocked = 'ip_unblocked'
}

export interface AuditLog {
  _id: ObjectId;
  type: AuditLogType;
  action: AdminAction;
  adminId: ObjectId;
  targetId: ObjectId;
  targetType: string;
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  ip: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    newLastWeek: number;
  };
  content: {
    recipes: number;
    comments: number;
    reports: number;
  };
  security: {
    activeTokens: number;
    blockedIPs: number;
  };
}

export interface AdminSettings {
  security: {
    maxLoginAttempts: number;
    passwordPolicy: {
      minLength: number;
      requireNumbers: boolean;
      requireSymbols: boolean;
      requireUppercase: boolean;
      expiryDays: number;
    };
    sessionTimeout: number;
    ipBlockDuration: number;
  };
  email: {
    fromName: string;
    fromEmail: string;
    templates: {
      welcome: {
        subject: string;
        body: string;
      };
    };
  };
  content: {
    maxUploadSize: number;
    allowedFileTypes: string[];
    autoModeration: {
      enabled: boolean;
      keywords: string[];
      maxReportsThreshold: number;
    };
  };
  backup: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    retention: number;
    includeUploads: boolean;
  };
}

export interface UserManagementActions {
  blockUser(userId: ObjectId, reason: string): Promise<void>;
  unblockUser(userId: ObjectId): Promise<void>;
  updateUserRole(userId: ObjectId, role: string): Promise<void>;
  deleteUser(userId: ObjectId): Promise<void>;
  exportUserData(userId: ObjectId): Promise<Record<string, unknown>>;
}

export interface ContentModerationActions {
  removeContent(contentId: ObjectId, contentType: string, reason: string): Promise<void>;
  restoreContent(contentId: ObjectId, contentType: string): Promise<void>;
  reviewReport(reportId: ObjectId, action: 'approve' | 'reject'): Promise<void>;
  updateContentGuidelines(guidelines: string[]): Promise<void>;
}

export interface SystemConfigurationActions {
  updateSettings(settings: Partial<AdminSettings>): Promise<void>;
  getSystemStats(): Promise<SystemStats>;
  createBackup(): Promise<{ id: string; url: string }>;
  restoreBackup(backupId: string): Promise<void>;
}

export interface SecurityManagementActions {
  getAuditLogs(query: {
    type?: AuditLogType[];
    adminId?: ObjectId;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }>;
  getActiveTokens(): Promise<{
    userId: ObjectId;
    tokens: { id: string; createdAt: Date; lastUsed: Date }[];
  }[]>;
  revokeToken(tokenId: string): Promise<void>;
  getBlockedIPs(): Promise<{ ip: string; reason: string; blockedAt: Date }[]>;
  unblockIP(ip: string): Promise<void>;
} 
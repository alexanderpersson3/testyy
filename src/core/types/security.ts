import { ObjectId } from 'mongodb';;;;
export type TwoFactorMethod = 'totp' | 'email' | 'sms';
export type SessionStatus = 'active' | 'expired' | 'revoked';
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';
export enum SecurityAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  EMAIL_CHANGE = 'email_change',
  DEVICE_ADDED = 'device_added',
  DEVICE_REMOVED = 'device_removed',
  TWO_FACTOR_ENABLE = 'two_factor_enable',
  TWO_FACTOR_DISABLE = 'two_factor_disable',
  TWO_FACTOR_VERIFY = 'two_factor_verify',
  RECOVERY_CODES_GENERATE = 'recovery_codes_generate',
  RECOVERY_CODE_USE = 'recovery_code_use',
  SESSION_REVOKE = 'session_revoke',
  DEVICE_REVOKE = 'device_revoke',
  DEVICE_AUTHORIZE = 'device_authorize',
  PRIVACY_SETTINGS_CHANGE = 'privacy_settings_change',
}

export interface TwoFactorConfig {
  _id: ObjectId;
  userId: ObjectId;
  method: TwoFactorMethod;
  secret?: string;
  backupCodes: string[];
  verified: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  _id: ObjectId;
  userId: ObjectId;
  token: string;
  status: SessionStatus;
  deviceInfo: {
    type: DeviceType;
    name: string;
    os: string;
    browser: string;
    ip: string;
    userAgent: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: [number, number];
  };
  lastActive: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityAuditLog {
  _id: ObjectId;
  userId: ObjectId;
  action: SecurityAction;
  status: 'success' | 'failure';
  deviceInfo: {
    type: DeviceType;
    name: string;
    os: string;
    browser: string;
    ip: string;
    userAgent: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface PrivacySettings {
  _id: ObjectId;
  userId: ObjectId;
  profile: {
    visibility: 'public' | 'private' | 'followers';
    showEmail: boolean;
    showLocation: boolean;
    showCollections: boolean;
    showCookingHistory: boolean;
    allowTagging: boolean;
    allowMentions: boolean;
  };
  search: {
    discoverable: boolean;
    includeInRecommendations: boolean;
    allowIndexing: boolean;
  };
  communication: {
    allowDirectMessages: boolean;
    allowComments: boolean;
    allowReviews: boolean;
    allowInvites: boolean;
  };
  data: {
    allowAnalytics: boolean;
    allowPersonalization: boolean;
    allowThirdPartySharing: boolean;
    retentionPeriod: number; // in days
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitConfig {
  _id: ObjectId;
  type: 'ip' | 'user' | 'endpoint';
  target: string;
  limit: number;
  window: number; // in seconds
  blockDuration: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitEntry {
  _id: ObjectId;
  type: 'ip' | 'user' | 'endpoint';
  target: string;
  count: number;
  firstRequest: Date;
  lastRequest: Date;
  blockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuspiciousActivity {
  _id: ObjectId;
  userId: ObjectId;
  type: 'login' | 'password_reset' | 'email_change' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high';
  deviceInfo: {
    type: DeviceType;
    name: string;
    os: string;
    browser: string;
    ip: string;
    userAgent: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: [number, number];
  };
  metadata?: Record<string, any>;
  status: 'pending' | 'resolved' | 'ignored';
  resolution?: {
    action: 'block' | 'allow' | 'require_2fa' | 'notify';
    resolvedBy?: ObjectId;
    resolvedAt?: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityPreferences {
  _id: ObjectId;
  userId: ObjectId;
  loginNotifications: boolean;
  newDeviceNotifications: boolean;
  suspiciousActivityNotifications: boolean;
  requirePasswordChange: number; // in days
  passwordHistory: number; // number of passwords to remember
  sessionTimeout: number; // in minutes
  maxActiveSessions: number;
  allowedIPs?: string[]; // IP whitelist
  blockedIPs?: string[]; // IP blacklist
  allowedCountries?: string[]; // Country whitelist
  blockedCountries?: string[]; // Country blacklist
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryCodes {
  _id: ObjectId;
  userId: ObjectId;
  codes: Array<{
    code: string;
    used: boolean;
    usedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityQuestion {
  _id: ObjectId;
  userId: ObjectId;
  question: string;
  answer: string; // hashed
  lastVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceAuthorization {
  _id: ObjectId;
  userId: ObjectId;
  deviceId: string;
  name: string;
  type: DeviceType;
  trusted: boolean;
  lastUsed: Date;
  expiresAt?: Date;
  metadata?: {
    os?: string;
    browser?: string;
    ip?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

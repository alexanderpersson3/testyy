import Joi from 'joi';
import { ObjectId } from 'mongodb';
import { AdminAction, AuditLogType } from '../types/admin.types.js';

const objectIdSchema = Joi.string().custom((value: string, helpers) => {
  if (!ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'ObjectId validation');

// User Management Schemas
export const blockUserSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required()
});

export const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'moderator', 'admin').required()
});

// Content Moderation Schemas
export const removeContentSchema = Joi.object({
  contentType: Joi.string().valid('recipe', 'comment', 'article').required(),
  reason: Joi.string().min(10).max(500).required()
});

export const restoreContentSchema = Joi.object({
  contentType: Joi.string().valid('recipe', 'comment', 'article').required()
});

export const reviewReportSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  comment: Joi.string().max(500).optional()
});

export const updateContentGuidelinesSchema = Joi.object({
  guidelines: Joi.array().items(
    Joi.object({
      category: Joi.string().required(),
      rules: Joi.array().items(Joi.string()).min(1).required()
    })
  ).min(1).required()
});

// System Configuration Schemas
export const updateSettingsSchema = Joi.object({
  security: Joi.object({
    maxLoginAttempts: Joi.number().min(3).max(10),
    passwordPolicy: Joi.object({
      minLength: Joi.number().min(8).max(32),
      requireNumbers: Joi.boolean(),
      requireSymbols: Joi.boolean(),
      requireUppercase: Joi.boolean(),
      expiryDays: Joi.number().min(30).max(180)
    }),
    sessionTimeout: Joi.number().min(300).max(86400),
    ipBlockDuration: Joi.number().min(300).max(86400)
  }),
  email: Joi.object({
    fromName: Joi.string().max(100),
    fromEmail: Joi.string().email(),
    templates: Joi.object({
      welcome: Joi.object({
        subject: Joi.string().max(200),
        body: Joi.string().max(5000)
      })
    })
  }),
  content: Joi.object({
    maxUploadSize: Joi.number().min(1024 * 1024).max(10 * 1024 * 1024),
    allowedFileTypes: Joi.array().items(Joi.string()),
    autoModeration: Joi.object({
      enabled: Joi.boolean(),
      keywords: Joi.array().items(Joi.string()),
      maxReportsThreshold: Joi.number().min(1).max(100)
    })
  }),
  backup: Joi.object({
    enabled: Joi.boolean(),
    frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
    retention: Joi.number().min(1).max(365),
    includeUploads: Joi.boolean()
  })
}).min(1);

// Security Management Schemas
export const getAuditLogsSchema = Joi.object({
  type: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  adminId: objectIdSchema.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

export const revokeTokenSchema = Joi.object({
  tokenId: objectIdSchema.required()
});

export const unblockIPSchema = Joi.object({
  ip: Joi.string().ip().required()
}); 
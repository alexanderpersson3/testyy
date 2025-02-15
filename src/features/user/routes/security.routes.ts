import { Router } from 'express';;
import type { Response } from '../types/express.js';
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import { auth } from '../middleware/auth.js';;
import type { validateRequest } from '../types/express.js';
import { z } from 'zod';;
import { rateLimitMiddleware } from '../middleware/rate-limit.js';;
import { asyncHandler } from '../utils/asyncHandler.js';;
import { DatabaseError, ValidationError } from '../utils/errors.js';;
import logger from '../utils/logger.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { SecurityAuditService } from '../services/security-audit.service.js';;
import { TwoFactorService } from '../services/two-factor.service.js';;
import { SecurityAction, DeviceType } from '../types/security.js';;
import { SessionService } from '../services/session.service.js';;

const router = Router();
const securityService = SecurityAuditService.getInstance();
const twoFactorService = TwoFactorService.getInstance();
const sessionService = SessionService.getInstance();

// Validation schemas
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

const deviceInfoSchema = z.object({
  type: z.enum(['mobile', 'tablet', 'desktop', 'unknown'] as const),
  name: z.string(),
  os: z.string(),
  browser: z.string(),
  ip: z.string(),
  userAgent: z.string(),
});

const auditLogQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actions: z.array(z.nativeEnum(SecurityAction)).optional(),
  status: z.array(z.enum(['success', 'failure'])).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// Log security event
router.post(
  '/audit/log',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(deviceInfoSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      await securityService.log({
        userId: new ObjectId(req.user.id),
        action: req.body.action,
        status: req.body.status,
        deviceInfo: req.body,
        metadata: req.body.metadata,
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to log security event:', error);
      throw new DatabaseError('Failed to log security event');
    }
  })
);

// Get audit logs
router.get(
  '/audit/logs',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(auditLogQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const logs = await securityService.getAuditLogs(new ObjectId(req.user.id), {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        actions: req.query.actions as SecurityAction[],
        status: req.query.status as ('success' | 'failure')[],
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(logs);
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      throw new DatabaseError('Failed to get audit logs');
    }
  })
);

// Get 2FA status
router.get(
  '/2fa/status',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const status = await twoFactorService.verify2FA(new ObjectId(req.user.id), '', {
        type: 'unknown' as DeviceType,
        name: 'Unknown',
        os: 'Unknown',
        browser: 'Unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
      res.json({ enabled: status });
    } catch (error) {
      logger.error('Failed to get 2FA status:', error);
      throw new DatabaseError('Failed to get 2FA status');
    }
  })
);

// Enable 2FA
router.post(
  '/2fa/enable',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const result = await twoFactorService.enable2FA(new ObjectId(req.user.id), {
        type: 'unknown' as DeviceType,
        name: 'Unknown',
        os: 'Unknown',
        browser: 'Unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
      res.json(result);
    } catch (error) {
      logger.error('Failed to enable 2FA:', error);
      throw new DatabaseError('Failed to enable 2FA');
    }
  })
);

// Disable 2FA
router.post(
  '/2fa/disable',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      await twoFactorService.disable2FA(new ObjectId(req.user.id), {
        type: 'unknown' as DeviceType,
        name: 'Unknown',
        os: 'Unknown',
        browser: 'Unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to disable 2FA:', error);
      throw new DatabaseError('Failed to disable 2FA');
    }
  })
);

// Verify 2FA token
router.post(
  '/2fa/verify',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(z.object({ token: z.string() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const isValid = await twoFactorService.verify2FA(
        new ObjectId(req.user.id), 
        req.body.token,
        {
          type: 'unknown' as DeviceType,
          name: 'Unknown',
          os: 'Unknown',
          browser: 'Unknown',
          ip: req.ip,
          userAgent: req.headers['user-agent'] || 'Unknown',
        }
      );
      res.json({ isValid });
    } catch (error) {
      logger.error('Failed to verify 2FA token:', error);
      throw new DatabaseError('Failed to verify 2FA token');
    }
  })
);

// Get active sessions
router.get(
  '/sessions',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const sessions = await sessionService.getActiveSessions(new ObjectId(req.user.id));
      res.json(sessions);
    } catch (error) {
      logger.error('Failed to get active sessions:', error);
      throw new DatabaseError('Failed to get active sessions');
    }
  })
);

// Revoke session
router.post(
  '/sessions/revoke',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(z.object({ sessionId: objectIdSchema })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      await sessionService.revokeSession(
        new ObjectId(req.user.id),
        new ObjectId(req.body.sessionId),
        {
          type: 'unknown' as DeviceType,
          name: 'Unknown',
          os: 'Unknown',
          browser: 'Unknown',
          ip: req.ip,
          userAgent: req.headers['user-agent'] || 'Unknown',
        }
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to revoke session:', error);
      throw new DatabaseError('Failed to revoke session');
    }
  })
);

// Revoke all other sessions
router.post(
  '/sessions/revoke-others',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const currentSession = await sessionService.getSessionByToken(req.headers.authorization?.split(' ')[1] || '');
      if (!currentSession) {
        throw new ValidationError('Invalid session');
      }

      await sessionService.revokeOtherSessions(
        new ObjectId(req.user.id),
        currentSession._id,
        {
          type: 'unknown' as DeviceType,
          name: 'Unknown',
          os: 'Unknown',
          browser: 'Unknown',
          ip: req.ip,
          userAgent: req.headers['user-agent'] || 'Unknown',
        }
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to revoke other sessions:', error);
      throw new DatabaseError('Failed to revoke other sessions');
    }
  })
);

// Get authorized devices
router.get(
  '/devices',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const devices = await sessionService.getAuthorizedDevices(new ObjectId(req.user.id));
      res.json(devices);
    } catch (error) {
      logger.error('Failed to get authorized devices:', error);
      throw new DatabaseError('Failed to get authorized devices');
    }
  })
);

// Revoke device
router.post(
  '/devices/revoke',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(z.object({ deviceId: z.string() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      await sessionService.revokeDevice(
        new ObjectId(req.user.id),
        req.body.deviceId,
        {
          type: 'unknown' as DeviceType,
          name: 'Unknown',
          os: 'Unknown',
          browser: 'Unknown',
          ip: req.ip,
          userAgent: req.headers['user-agent'] || 'Unknown',
        }
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to revoke device:', error);
      throw new DatabaseError('Failed to revoke device');
    }
  })
);

// Get suspicious activities schema
const getSuspiciousActivitiesSchema = z.object({
  status: z.array(z.enum(['pending', 'resolved', 'ignored'])).optional(),
  type: z.array(z.enum(['login', 'password_reset', 'email_change', 'unusual_activity'])).optional(),
  severity: z.array(z.enum(['low', 'medium', 'high'])).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// Get suspicious activities
router.get(
  '/suspicious-activities',
  auth,
  validateRequest(getSuspiciousActivitiesSchema, 'query'),
  async (req: any, res: any) => {
    try {
      const activities = await securityService.getSuspiciousActivities(new ObjectId(req.user!.id), {
        status: req.query.status as any[],
        type: req.query.type as any[],
        severity: req.query.severity as any[],
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get suspicious activities' });
    }
  }
);

// Update suspicious activity schema
const updateSuspiciousActivitySchema = z.object({
  activityId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  status: z.enum(['resolved', 'ignored']),
  resolution: z
    .object({
      action: z.enum(['block', 'allow', 'require_2fa', 'notify']),
      notes: z.string().optional(),
    })
    .optional(),
});

// Update suspicious activity
router.post(
  '/suspicious-activities/update',
  auth,
  validateRequest(updateSuspiciousActivitySchema),
  async (req: any, res: any) => {
    try {
      await securityService.updateActivityStatus(
        new ObjectId(req.body.activityId),
        req.body.status,
        req.body.resolution
      );
      res.status(200).json({ message: 'Activity updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update activity' });
    }
  }
);

export default router;

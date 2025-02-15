import { Router } from 'express';;
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import { z } from 'zod';;
import { NotificationService } from '../services/notification.service.js';;
import { auth } from '../middleware/auth.js';;
import { validate } from '../middleware/validate.js';;
import type { AuthenticatedTypedRequest, TypedResponse, AuthenticatedRequestHandler } from '../types/express.js';
import type { ParamsDictionary } from '../types/express.js';

const router = Router();
const notificationService = NotificationService.getInstance();

interface NotificationQueryParams {
  unreadOnly?: string;
  limit?: string;
  before?: string;
  [key: string]: string | undefined;
}

interface NotificationParams extends ParamsDictionary {
  notificationId: string;
}

interface NotificationPreferencesBody {
  channels?: Record<NotificationChannel, NotificationMethod[]>;
  schedule?: {
    digest?: boolean;
    digestFrequency?: 'daily' | 'weekly';
    digestTime?: string;
    quietHours?: {
      enabled?: boolean;
      start?: string;
      end?: string;
    };
  };
}

type NotificationChannel =
  | 'new_follower'
  | 'follow_request'
  | 'follow_accepted'
  | 'new_story'
  | 'story_update'
  | 'story_like'
  | 'story_comment'
  | 'recipe_comment'
  | 'recipe_like'
  | 'recipe_share'
  | 'collection_share'
  | 'cooking_session_invite'
  | 'cooking_session_update'
  | 'performance_alert'
  | 'security_alert'
  | 'system_update';

type NotificationMethod = 'in_app' | 'email' | 'push' | 'sms';

// Get notifications schema
const getNotificationsSchema = z.object({
  unreadOnly: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  limit: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  before: z.string().datetime().optional(),
});

// Get notifications
router.get(
  '/',
  auth,
  validate(getNotificationsSchema, 'query'),
  (async (req: AuthenticatedTypedRequest<ParamsDictionary, Record<string, never>, NotificationQueryParams>, res: TypedResponse) => {
    const notifications = await notificationService.getNotifications(new ObjectId(req.user.id), {
      unreadOnly: req.query.unreadOnly === 'true',
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      before: req.query.before ? new Date(req.query.before) : undefined,
    });
    res.json(notifications);
  }) as AuthenticatedRequestHandler<ParamsDictionary, any, Record<string, never>, NotificationQueryParams>
);

// Mark notification as read
router.post(
  '/:notificationId/read',
  auth,
  validate(z.object({ notificationId: z.string().regex(/^[0-9a-fA-F]{24}$/) }), 'params'),
  (async (req: AuthenticatedTypedRequest<NotificationParams, Record<string, never>>, res: TypedResponse) => {
    await notificationService.markAsRead(new ObjectId(req.params.notificationId), new ObjectId(req.user.id));
    res.status(204).send();
  }) as AuthenticatedRequestHandler<NotificationParams, any, Record<string, never>>
);

// Mark all notifications as read
router.post(
  '/read-all',
  auth,
  (async (req: AuthenticatedTypedRequest<ParamsDictionary, Record<string, never>>, res: TypedResponse) => {
    const count = await notificationService.markAllAsRead(new ObjectId(req.user.id));
    res.json({ count });
  }) as AuthenticatedRequestHandler<ParamsDictionary, any, Record<string, never>>
);

// Dismiss notification
router.post(
  '/:notificationId/dismiss',
  auth,
  validate(z.object({ notificationId: z.string().regex(/^[0-9a-fA-F]{24}$/) }), 'params'),
  (async (req: AuthenticatedTypedRequest<NotificationParams, Record<string, never>>, res: TypedResponse) => {
    const success = await notificationService.dismissNotification(
      new ObjectId(req.params.notificationId),
      new ObjectId(req.user.id)
    );
    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.status(204).send();
  }) as AuthenticatedRequestHandler<NotificationParams, any, Record<string, never>>
);

// Get notification preferences
router.get(
  '/preferences',
  auth,
  (async (req: AuthenticatedTypedRequest<ParamsDictionary, Record<string, never>>, res: TypedResponse) => {
    const preferences = await notificationService.getPreferences(new ObjectId(req.user.id));
    res.json(preferences);
  }) as AuthenticatedRequestHandler<ParamsDictionary, any, Record<string, never>>
);

// Update notification preferences schema
const updatePreferencesSchema = z.object({
  channels: z
    .record(
      z.enum([
        'new_follower',
        'follow_request',
        'follow_accepted',
        'new_story',
        'story_update',
        'story_like',
        'story_comment',
        'recipe_comment',
        'recipe_like',
        'recipe_share',
        'collection_share',
        'cooking_session_invite',
        'cooking_session_update',
        'performance_alert',
        'security_alert',
        'system_update',
      ]),
      z.array(z.enum(['in_app', 'email', 'push', 'sms']))
    )
    .optional(),
  schedule: z
    .object({
      digest: z.boolean().optional(),
      digestFrequency: z.enum(['daily', 'weekly']).optional(),
      digestTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      quietHours: z
        .object({
          enabled: z.boolean().optional(),
          start: z
            .string()
            .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .optional(),
          end: z
            .string()
            .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

// Update notification preferences
router.patch(
  '/preferences',
  auth,
  validate(updatePreferencesSchema),
  (async (req: AuthenticatedTypedRequest<ParamsDictionary, NotificationPreferencesBody>, res: TypedResponse) => {
    const preferences = await notificationService.updatePreferences(new ObjectId(req.user.id), req.body);
    res.json(preferences);
  }) as AuthenticatedRequestHandler<ParamsDictionary, any, NotificationPreferencesBody>
);

export default router;

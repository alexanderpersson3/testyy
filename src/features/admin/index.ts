import express, { RequestHandler } from 'express';
import { AdminController } from './controllers/admin.controller.js';
import { authenticate } from '../../core/middleware/authenticate.js';
import { validateRequest } from '../../core/middleware/validate-request.js';
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
} from './schemas/admin.schema.js';

const router = express.Router();
const controller = new AdminController();

// User Management Routes
router.post(
  '/users/:id/block',
  authenticate(['admin']),
  validateRequest({ body: blockUserSchema }),
  controller.blockUser.bind(controller) as RequestHandler
);

router.post(
  '/users/:id/unblock',
  authenticate(['admin']),
  controller.unblockUser.bind(controller) as RequestHandler
);

router.put(
  '/users/:id/role',
  authenticate(['admin']),
  validateRequest({ body: updateUserRoleSchema }),
  controller.updateUserRole.bind(controller) as RequestHandler
);

// Content Moderation Routes
router.post(
  '/content/:id/remove',
  authenticate(['admin', 'moderator']),
  validateRequest({ body: removeContentSchema }),
  controller.removeContent.bind(controller) as RequestHandler
);

router.post(
  '/reports/:id/review',
  authenticate(['admin', 'moderator']),
  validateRequest({ body: reviewReportSchema }),
  controller.reviewReport.bind(controller) as RequestHandler
);

// System Configuration Routes
router.get(
  '/stats',
  authenticate(['admin']),
  controller.getSystemStats.bind(controller) as RequestHandler
);

// Security Management Routes
router.get(
  '/audit-logs',
  authenticate(['admin']),
  validateRequest({ query: getAuditLogsSchema }),
  controller.getAuditLogs.bind(controller) as RequestHandler
);

router.get(
  '/blocked-ips',
  authenticate(['admin']),
  controller.getBlockedIPs.bind(controller) as RequestHandler
);

export { router as adminRoutes }; 
import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { validateRequest } from '../../../core/middleware/validate-request.js';
import { authenticate } from '../../../core/middleware/authenticate.js';
import { authorize } from '../../../core/middleware/authorize.js';
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

const router = Router();
const adminController = new AdminController();

// User Management Routes
router.post(
  '/users/:userId/block',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: blockUserSchema }),
  adminController.blockUser
);

router.post(
  '/users/:userId/unblock',
  authenticate,
  authorize(['admin']),
  adminController.unblockUser
);

router.put(
  '/users/:userId/role',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: updateUserRoleSchema }),
  adminController.updateUserRole
);

router.delete(
  '/users/:userId',
  authenticate,
  authorize(['admin']),
  adminController.deleteUser
);

router.get(
  '/users/:userId/export',
  authenticate,
  authorize(['admin']),
  adminController.exportUserData
);

// Content Moderation Routes
router.post(
  '/content/:contentId/remove',
  authenticate,
  authorize(['admin', 'moderator']),
  validateRequest({ body: removeContentSchema }),
  adminController.removeContent
);

router.post(
  '/content/:contentId/restore',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: restoreContentSchema }),
  adminController.restoreContent
);

router.post(
  '/reports/:reportId/review',
  authenticate,
  authorize(['admin', 'moderator']),
  validateRequest({ body: reviewReportSchema }),
  adminController.reviewReport
);

router.put(
  '/content/guidelines',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: updateContentGuidelinesSchema }),
  adminController.updateContentGuidelines
);

// System Configuration Routes
router.put(
  '/settings',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: updateSettingsSchema }),
  adminController.updateSettings
);

router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  adminController.getSystemStats
);

router.post(
  '/backup',
  authenticate,
  authorize(['admin']),
  adminController.createBackup
);

router.post(
  '/backup/restore',
  authenticate,
  authorize(['admin']),
  adminController.restoreBackup
);

// Security Management Routes
router.get(
  '/audit-logs',
  authenticate,
  authorize(['admin']),
  validateRequest({ query: getAuditLogsSchema }),
  adminController.getAuditLogs
);

router.get(
  '/active-tokens',
  authenticate,
  authorize(['admin']),
  adminController.getActiveTokens
);

router.post(
  '/tokens/:tokenId/revoke',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: revokeTokenSchema }),
  adminController.revokeToken
);

router.get(
  '/blocked-ips',
  authenticate,
  authorize(['admin']),
  adminController.getBlockedIPs
);

router.post(
  '/blocked-ips/:ip/unblock',
  authenticate,
  authorize(['admin']),
  validateRequest({ body: unblockIPSchema }),
  adminController.unblockIP
);

export default router; 
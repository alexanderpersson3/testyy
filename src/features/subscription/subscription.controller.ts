import { Router, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { auth, AuthenticatedRequest } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate-limit';
import { subscriptionService } from './subscription.service';
import { Platform } from './types';
import { ParamsDictionary } from 'express-serve-static-core';

const router = Router();

// Validation schemas
const androidPurchaseSchema = z.object({
  packageName: z.string(),
  subscriptionId: z.string(),
  purchaseToken: z.string(),
});

const iosPurchaseSchema = z.object({
  receiptData: z.string(),
});

type AuthHandler = (req: AuthenticatedRequest, res: Response) => Promise<any>;

// Purchase validation and subscription creation
const validatePurchase: AuthHandler = async (req, res) => {
  const { platform } = req.body;

  if (!Object.values(Platform).includes(platform)) {
    return res.status(400).json({ message: 'Invalid platform' });
  }

  let purchaseData;
  if (platform === Platform.ANDROID) {
    purchaseData = androidPurchaseSchema.parse(req.body);
  } else {
    purchaseData = iosPurchaseSchema.parse(req.body);
  }

  const subscription = await subscriptionService.createOrUpdateSubscription(
    req.user._id,
    platform,
    purchaseData
  );

  res.json(subscription);
};

// Get subscription details
const getSubscriptionDetails: AuthHandler = async (req, res) => {
  const details = await subscriptionService.getSubscriptionDetails(req.user._id);
  res.json(details);
};

// Restore purchases
const restorePurchases: AuthHandler = async (req, res) => {
  const { platform } = req.body;

  if (!Object.values(Platform).includes(platform)) {
    return res.status(400).json({ message: 'Invalid platform' });
  }

  let purchaseData;
  if (platform === Platform.ANDROID) {
    purchaseData = androidPurchaseSchema.parse(req.body);
  } else {
    purchaseData = iosPurchaseSchema.parse(req.body);
  }

  const subscription = await subscriptionService.createOrUpdateSubscription(
    req.user._id,
    platform,
    purchaseData
  );

  res.json(subscription);
};

// Webhook endpoints for platform notifications
const handleGooglePlayWebhook: RequestHandler = (req, res, next) => {
  subscriptionService.handleGooglePlayNotification(req.body)
    .then(() => res.status(200).send())
    .catch(next);
};

const handleAppStoreWebhook: RequestHandler = (req, res, next) => {
  subscriptionService.handleAppStoreNotification(req.body)
    .then(() => res.status(200).send())
    .catch(next);
};

router.post('/validate', auth.authenticateToken, rateLimiter, validatePurchase as RequestHandler);
router.get('/details', auth.authenticateToken, getSubscriptionDetails as RequestHandler);
router.post('/restore', auth.authenticateToken, rateLimiter, restorePurchases as RequestHandler);
router.post('/webhooks/google-play', handleGooglePlayWebhook);
router.post('/webhooks/app-store', handleAppStoreWebhook);

export { router as subscriptionRoutes }; 
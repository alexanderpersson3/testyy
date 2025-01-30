import express, { Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { SettingsService } from '../services/settings.js';

const router = express.Router();

// Get user settings
router.get('/',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const settingsService = new SettingsService(db.collection('user_settings'));

    const settings = await settingsService.getSettings(new ObjectId(req.user!.id));
    res.json({ settings });
  })
);

// Update user settings
router.patch('/',
  auth,
  [
    check('shoppingList').optional().isObject(),
    check('shoppingList.checkedItemsAtBottom').optional().isBoolean(),
    check('shoppingList.sortCheckedAlphabetically').optional().isBoolean(),
    check('shoppingList.enableReminders').optional().isBoolean(),
    check('shoppingList.sortFavoritesAlphabetically').optional().isBoolean(),
    check('shoppingList.enableSharedLists').optional().isBoolean(),
    check('notifications').optional().isObject(),
    check('notifications.email').optional().isBoolean(),
    check('notifications.push').optional().isBoolean(),
    check('notifications.sharedListUpdates').optional().isBoolean(),
    check('notifications.newFollowers').optional().isBoolean(),
    check('notifications.newComments').optional().isBoolean(),
    check('notifications.weeklyDigest').optional().isBoolean(),
    check('display').optional().isObject(),
    check('display.theme').optional().isIn(['light', 'dark', 'system']),
    check('display.language').optional().isString(),
    check('display.timezone').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const settingsService = new SettingsService(db.collection('user_settings'));

    await settingsService.updateSettings(new ObjectId(req.user!.id), req.body);
    res.json({ success: true });
  })
);

// Update shopping list settings
router.patch('/shopping-list',
  auth,
  [
    check('checkedItemsAtBottom').optional().isBoolean(),
    check('sortCheckedAlphabetically').optional().isBoolean(),
    check('enableReminders').optional().isBoolean(),
    check('sortFavoritesAlphabetically').optional().isBoolean(),
    check('enableSharedLists').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const settingsService = new SettingsService(db.collection('user_settings'));

    await settingsService.updateShoppingListSettings(new ObjectId(req.user!.id), req.body);
    res.json({ success: true });
  })
);

// Update notification settings
router.patch('/notifications',
  auth,
  [
    check('email').optional().isBoolean(),
    check('push').optional().isBoolean(),
    check('sharedListUpdates').optional().isBoolean(),
    check('newFollowers').optional().isBoolean(),
    check('newComments').optional().isBoolean(),
    check('weeklyDigest').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const settingsService = new SettingsService(db.collection('user_settings'));

    await settingsService.updateNotificationSettings(new ObjectId(req.user!.id), req.body);
    res.json({ success: true });
  })
);

// Update display settings
router.patch('/display',
  auth,
  [
    check('theme').optional().isIn(['light', 'dark', 'system']),
    check('language').optional().isString(),
    check('timezone').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const settingsService = new SettingsService(db.collection('user_settings'));

    await settingsService.updateDisplaySettings(new ObjectId(req.user!.id), req.body);
    res.json({ success: true });
  })
);

export default router; 
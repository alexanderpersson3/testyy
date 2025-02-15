import express, { Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { ContactImportService } from '../services/contact-import.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
const router = express.Router();
const contactImportService = ContactImportService.getInstance();
// Validation schemas
const phoneContactSchema = z.object({
    phoneNumber: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
}).strict();
const importPhoneContactsSchema = z.object({
    contacts: z.array(phoneContactSchema),
}).strict();
const socialImportSchema = z.object({
    accessToken: z.string().min(1, 'Access token is required'),
}).strict();
// Import phone contacts
router.post('/import/phone', auth, validateRequest(importPhoneContactsSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const result = await contactImportService.importPhoneContacts(new ObjectId(req.user.id), req.body.contacts);
    res.json({ success: true, ...result });
}));
// Import Facebook contacts
router.post('/import/facebook', auth, validateRequest(socialImportSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const result = await contactImportService.importFacebookContacts(new ObjectId(req.user.id), req.body.accessToken);
    res.json({ success: true, ...result });
}));
// Import Instagram contacts
router.post('/import/instagram', auth, validateRequest(socialImportSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const result = await contactImportService.importInstagramContacts(new ObjectId(req.user.id), req.body.accessToken);
    res.json({ success: true, ...result });
}));
export default router;
//# sourceMappingURL=contacts.js.map
import express, { Request, Response } from 'express';
;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InvitationService } from '../services/invitation.js';
import { sendInvitationEmail } from '../utils/email.js';
import { AuthError } from '../utils/errors.js';
import { User } from '../types/user.js';
import { Invitation } from '../services/invitation.js';
const router = express.Router();
const invitationService = new InvitationService(getCollection('invitations'), getCollection('users'));
// Send invitation
router.post('/', auth, [
    check('email').isEmail().normalizeEmail(),
    check('name').trim().notEmpty()
], asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email, name } = req.body;
        const invitation = await invitationService.createInvitation(new ObjectId(req.user.id), email, name);
        // Send invitation email
        await sendInvitationEmail(invitation.email, invitation.token, invitation.name);
        res.status(201).json({ invitation });
    }
    catch (error) {
        if (error.message === 'User already registered' ||
            error.message === 'Invitation already sent') {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
}));
// Get user's sent invitations
router.get('/sent', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const invitations = await invitationService.getUserInvitations(new ObjectId(req.user.id));
    res.json({ invitations });
}));
// Accept invitation
router.post('/:token/accept', [check('password').isLength({ min: 8 }), check('name').trim().notEmpty()], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const invitation = await invitationService.getInvitation(req.params.token);
        if (!invitation) {
            return res.status(404).json({ message: 'Invalid invitation token' });
        }
        await invitationService.acceptInvitation(req.params.token);
        // Create user account
        const user = {
            email: invitation.email,
            name: req.body.name,
            password: req.body.password, // Note: Hash this password before saving
            role: 'user',
            isVerified: true,
            isPro: false,
            invitedBy: invitation.invitedBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await getCollection('users').insertOne(user);
        res.json({ message: 'Invitation accepted successfully' });
    }
    catch (error) {
        if (error.message === 'Invalid invitation token' ||
            error.message === 'Invitation is no longer valid' ||
            error.message === 'Invitation has expired') {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
}));
// Get invitation details
router.get('/:token', asyncHandler(async (req, res) => {
    const invitation = await invitationService.getInvitation(req.params.token);
    if (!invitation) {
        return res.status(404).json({ message: 'Invalid invitation token' });
    }
    res.json({ invitation });
}));
export default router;
//# sourceMappingURL=invitations.js.map
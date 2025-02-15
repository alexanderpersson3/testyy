import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import { PhoneContact, SocialContact, ContactMatch, ContactImportResult, SocialAuthToken, } from '../types/contacts.js';
import logger from '../utils/logger.js';
export class ContactImportService {
    constructor() {
        // These will be initialized properly when needed
        this.facebookAuth = {};
        this.instagramAuth = {};
    }
    static getInstance() {
        if (!ContactImportService.instance) {
            ContactImportService.instance = new ContactImportService();
        }
        return ContactImportService.instance;
    }
    /**
     * Import phone contacts
     */
    async importPhoneContacts(userId, contacts) {
        try {
            await connectToDatabase();
            const matches = [];
            // Normalize phone numbers
            const normalizedContacts = contacts.map(contact => ({
                ...contact,
                phoneNumber: this.normalizePhoneNumber(contact.phoneNumber),
            }));
            // Find users by phone numbers
            const phoneMatches = await getCollection('users')
                .find({
                phoneNumber: {
                    $in: normalizedContacts.map(c => c.phoneNumber),
                },
            })
                .toArray();
            // Find users by email
            const emailMatches = await getCollection('users')
                .find({
                email: {
                    $in: normalizedContacts.filter(c => c.email).map(c => c.email),
                },
            })
                .toArray();
            // Combine matches
            [...phoneMatches, ...emailMatches].forEach(user => {
                if (!user._id.equals(userId)) {
                    matches.push({
                        userId: user._id,
                        username: user.username,
                        displayName: user.displayName,
                        avatar: user.avatar,
                        matchType: phoneMatches.includes(user) ? 'phone' : 'email',
                    });
                }
            });
            return {
                matches: matches.filter((match, index, self) => index === self.findIndex(m => m.userId.equals(match.userId))),
                totalContacts: contacts.length,
            };
        }
        catch (error) {
            logger.error('Failed to import phone contacts:', error);
            throw error;
        }
    }
    /**
     * Import Facebook contacts
     */
    async importFacebookContacts(userId, accessToken) {
        try {
            await connectToDatabase();
            const matches = [];
            // Get Facebook friends
            const friends = await this.facebookAuth.getFriends(accessToken);
            // Find users by Facebook IDs
            const socialMatches = await getCollection('users')
                .find({
                'socialConnections.facebook.id': {
                    $in: friends.map((f) => f.platformUserId),
                },
            })
                .toArray();
            // Find users by email
            const emailMatches = await getCollection('users')
                .find({
                email: {
                    $in: friends
                        .filter((f) => f.email)
                        .map((f) => f.email),
                },
            })
                .toArray();
            // Combine matches
            [...socialMatches, ...emailMatches].forEach(user => {
                if (!user._id.equals(userId)) {
                    matches.push({
                        userId: user._id,
                        username: user.username,
                        displayName: user.displayName,
                        avatar: user.avatar,
                        matchType: socialMatches.includes(user) ? 'social' : 'email',
                        platform: 'facebook',
                    });
                }
            });
            return {
                matches: matches.filter((match, index, self) => index === self.findIndex(m => m.userId.equals(match.userId))),
                totalContacts: friends.length,
            };
        }
        catch (error) {
            logger.error('Failed to import Facebook contacts:', error);
            throw error;
        }
    }
    /**
     * Import Instagram contacts
     */
    async importInstagramContacts(userId, accessToken) {
        try {
            await connectToDatabase();
            const matches = [];
            // Get Instagram followers
            const followers = await this.instagramAuth.getFollowers(accessToken);
            // Find users by Instagram IDs
            const socialMatches = await getCollection('users')
                .find({
                'socialConnections.instagram.id': {
                    $in: followers.map((f) => f.platformUserId),
                },
            })
                .toArray();
            // Find users by email
            const emailMatches = await getCollection('users')
                .find({
                email: {
                    $in: followers
                        .filter((f) => f.email)
                        .map((f) => f.email),
                },
            })
                .toArray();
            // Combine matches
            [...socialMatches, ...emailMatches].forEach(user => {
                if (!user._id.equals(userId)) {
                    matches.push({
                        userId: user._id,
                        username: user.username,
                        displayName: user.displayName,
                        avatar: user.avatar,
                        matchType: socialMatches.includes(user) ? 'social' : 'email',
                        platform: 'instagram',
                    });
                }
            });
            return {
                matches: matches.filter((match, index, self) => index === self.findIndex(m => m.userId.equals(match.userId))),
                totalContacts: followers.length,
            };
        }
        catch (error) {
            logger.error('Failed to import Instagram contacts:', error);
            throw error;
        }
    }
    /**
     * Normalize phone number to E.164 format
     */
    normalizePhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        const digits = phoneNumber.replace(/\D/g, '');
        // Add country code if missing (assuming Swedish numbers)
        if (digits.length === 9) {
            return `+46${digits}`;
        }
        if (digits.length === 10 && digits.startsWith('0')) {
            return `+46${digits.substring(1)}`;
        }
        if (digits.length === 11 && digits.startsWith('0')) {
            return `+${digits.substring(1)}`;
        }
        if (digits.length === 12 && digits.startsWith('00')) {
            return `+${digits.substring(2)}`;
        }
        if (digits.startsWith('46')) {
            return `+${digits}`;
        }
        return `+${digits}`;
    }
}
//# sourceMappingURL=contact-import.service.js.map
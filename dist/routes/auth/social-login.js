;
import { z } from 'zod';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { DatabaseService } from '../../db/database.service.js';
import { generateToken } from '../../utils/auth.js';
import { ObjectId } from 'mongodb';
;
import { verifyGoogleToken } from '../../services/google-auth.js';
import { verifyFacebookToken } from '../../services/facebook-auth.js';
import { verifyAppleToken } from '../../services/apple-auth.js';
import { UserRole, TokenPayload } from '../../types/auth.js';
import { DatabaseError, ValidationError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
const router = Router();
const dbService = DatabaseService.getInstance();
// Validation schemas
const socialLoginSchema = z.object({
    token: z.string(),
    provider: z.enum(['google', 'facebook', 'apple']),
});
// Social login endpoint
router.post('/social', rateLimitMiddleware.auth, validateRequest(socialLoginSchema), asyncHandler(async (req, res) => {
    const { token, provider } = req.body;
    let socialId;
    let email;
    let name;
    // Verify token with appropriate provider
    try {
        switch (provider) {
            case 'google': {
                const googleUser = await verifyGoogleToken(token);
                socialId = googleUser.sub;
                email = googleUser.email;
                name = googleUser.name;
                break;
            }
            case 'facebook': {
                const facebookUser = await verifyFacebookToken(token);
                socialId = facebookUser.id;
                email = facebookUser.email;
                name = facebookUser.name;
                break;
            }
            case 'apple': {
                const appleUser = await verifyAppleToken(token);
                socialId = appleUser.sub;
                email = appleUser.email;
                name = appleUser.name;
                break;
            }
            default:
                throw new ValidationError('Invalid provider');
        }
    }
    catch (error) {
        logger.error(`Failed to verify ${provider} token:`, error);
        throw new ValidationError(`Invalid ${provider} token`);
    }
    try {
        // Find or create user
        let user = await dbService.getCollection('users').findOne({
            $or: [{ [`socialAuth.${provider}.id`]: socialId }, { email }],
        });
        if (!user) {
            // Create new user
            const newUser = {
                _id: new ObjectId(),
                email,
                name,
                role: UserRole.USER,
                isVerified: true,
                isPro: false,
                socialAuth: {
                    [provider]: {
                        id: socialId,
                        email,
                        name,
                    },
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await dbService.getCollection('users').insertOne(newUser);
            user = newUser;
        }
        else if (!user.socialAuth?.[provider]) {
            // Link social account to existing user
            await dbService.getCollection('users').updateOne({ _id: user._id }, {
                $set: {
                    [`socialAuth.${provider}`]: {
                        id: socialId,
                        email,
                        name,
                    },
                    updatedAt: new Date(),
                },
            });
        }
        // Generate token
        const tokenPayload = {
            id: user._id.toString(),
            email: user.email,
            name: user.name || '',
            role: user.role,
        };
        const authToken = generateToken(tokenPayload);
        res.json({
            success: true,
            token: authToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                isVerified: user.isVerified,
                isPro: user.isPro,
            },
        });
    }
    catch (error) {
        logger.error('Social login error:', error);
        throw new DatabaseError('Failed to process social login');
    }
}));
export default router;
//# sourceMappingURL=social-login.js.map
import { Router } from 'express';
import { z } from 'zod';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { getDb } from '../../db.js';
import { generateToken } from '../../utils/auth.js';
import { verifyGoogleToken } from '../../services/google-auth.js';
import { verifyFacebookToken } from '../../services/facebook-auth.js';
import { verifyAppleToken } from '../../services/apple-auth.js';
const router = Router();
// Validation schemas
const socialLoginSchema = z.object({
    token: z.string(),
    provider: z.enum(['google', 'facebook', 'apple'])
});
// Rate limiters
const socialLoginLimiter = rateLimitMiddleware.auth();
// Social login endpoint
router.post('/social', socialLoginLimiter, async (req, res) => {
    try {
        const { token, provider } = await socialLoginSchema.parseAsync(req.body);
        const db = await getDb();
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
                    throw new Error('Invalid provider');
            }
        }
        catch (error) {
            console.error(`Failed to verify ${provider} token:`, error);
            return res.status(401).json({
                success: false,
                message: `Invalid ${provider} token`
            });
        }
        // Find or create user
        let user = await db.collection('users').findOne({
            $or: [
                { [`socialAuth.${provider}.id`]: socialId },
                { email }
            ]
        });
        if (!user) {
            // Create new user
            const newUser = {
                email,
                name,
                role: 'user',
                socialAuth: {
                    [provider]: {
                        id: socialId,
                        email,
                        name
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await db.collection('users').insertOne(newUser);
            user = {
                ...newUser,
                _id: result.insertedId
            };
        }
        else if (!user.socialAuth?.[provider]) {
            // Link social account to existing user
            await db.collection('users').updateOne({ _id: user._id }, {
                $set: {
                    [`socialAuth.${provider}`]: {
                        id: socialId,
                        email,
                        name
                    },
                    updatedAt: new Date()
                }
            });
        }
        // Generate token
        const tokenPayload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role || 'user'
        };
        const authToken = generateToken(tokenPayload);
        res.json({
            success: true,
            token: authToken
        });
    }
    catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process social login'
        });
    }
});
export default router;
//# sourceMappingURL=social-login.js.map
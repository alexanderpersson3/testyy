import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error('Invalid token payload');
        }
        if (!payload.email_verified) {
            throw new Error('Email not verified');
        }
        return {
            sub: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified,
            name: payload.name,
            picture: payload.picture
        };
    }
    catch (error) {
        console.error('Google token verification failed:', error);
        throw new Error('Invalid Google token');
    }
}
//# sourceMappingURL=google-auth.js.map
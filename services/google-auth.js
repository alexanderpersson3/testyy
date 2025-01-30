import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class GoogleAuthService {
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  getAuthUrl() {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    });
  }

  async verifyGoogleToken(token) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      return ticket.getPayload();
    } catch (error) {
      console.error('Google token verification error:', error);
      return null;
    }
  }

  async getUserFromGoogle(code) {
    try {
      const { tokens } = await this.client.getToken(code);
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      
      const payload = ticket.getPayload();
      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        email_verified: payload.email_verified
      };
    } catch (error) {
      console.error('Error getting user from Google:', error);
      throw new Error('Failed to authenticate with Google');
    }
  }

  async findOrCreateUser(googleUser) {
    const db = await getDb();
    
    // Try to find existing user
    let user = await db.collection('users').findOne({
      $or: [
        { googleId: googleUser.googleId },
        { email: googleUser.email }
      ]
    });

    if (user) {
      // Update existing user with latest Google info
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            googleId: googleUser.googleId,
            name: googleUser.name,
            picture: googleUser.picture,
            email_verified: googleUser.email_verified,
            updated_at: new Date()
          }
        }
      );
    } else {
      // Create new user
      const result = await db.collection('users').insertOne({
        ...googleUser,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date()
      });
      user = {
        _id: result.insertedId,
        ...googleUser
      };
    }

    return user;
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  async handleCallback(code) {
    const googleUser = await this.getUserFromGoogle(code);
    const user = await this.findOrCreateUser(googleUser);
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role
      },
      tokens
    };
  }
}

export default new GoogleAuthService(); 
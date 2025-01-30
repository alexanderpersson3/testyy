import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import twilio from 'twilio';
import crypto from 'crypto';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

class ContactManager {
  constructor() {
    // Initialize Twilio client
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  /**
   * Start phone number verification process
   * @param {string} userId User ID
   * @param {string} phoneNumber Phone number to verify
   * @returns {Promise<Object>} Verification details
   */
  async startPhoneVerification(userId, phoneNumber) {
    try {
      const db = getDb();

      // Validate phone number format
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Parse and normalize phone number
      const parsedNumber = parsePhoneNumber(phoneNumber);
      const normalizedNumber = parsedNumber.format('E.164');

      // Check if phone number is already verified by another user
      const existingUser = await db.collection('users').findOne({
        phoneNumber: normalizedNumber,
        phoneVerified: true,
        _id: { $ne: new ObjectId(userId) }
      });

      if (existingUser) {
        throw new Error('Phone number already verified by another user');
      }

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Code expires in 10 minutes

      // Store verification attempt
      await db.collection('phoneVerifications').insertOne({
        userId: new ObjectId(userId),
        phoneNumber: normalizedNumber,
        code: verificationCode,
        attempts: 0,
        expiresAt,
        createdAt: new Date()
      });

      // Send SMS with verification code
      await this.twilioClient.messages.create({
        body: `Your verification code is: ${verificationCode}`,
        to: normalizedNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });

      return {
        phoneNumber: normalizedNumber,
        expiresAt
      };
    } catch (error) {
      console.error('Error starting phone verification:', error);
      throw error;
    }
  }

  /**
   * Verify phone number with code
   * @param {string} userId User ID
   * @param {string} phoneNumber Phone number
   * @param {string} code Verification code
   * @returns {Promise<Object>} Verification result
   */
  async verifyPhoneNumber(userId, phoneNumber, code) {
    try {
      const db = getDb();

      const parsedNumber = parsePhoneNumber(phoneNumber);
      const normalizedNumber = parsedNumber.format('E.164');

      // Find verification attempt
      const verification = await db.collection('phoneVerifications').findOne({
        userId: new ObjectId(userId),
        phoneNumber: normalizedNumber,
        expiresAt: { $gt: new Date() }
      });

      if (!verification) {
        throw new Error('Verification not found or expired');
      }

      if (verification.attempts >= 3) {
        throw new Error('Too many verification attempts');
      }

      // Update attempts
      await db.collection('phoneVerifications').updateOne(
        { _id: verification._id },
        { $inc: { attempts: 1 } }
      );

      if (verification.code !== code) {
        throw new Error('Invalid verification code');
      }

      // Update user's phone number
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            phoneNumber: normalizedNumber,
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
            phoneNumberHash: this.hashPhoneNumber(normalizedNumber)
          }
        }
      );

      // Clean up verification
      await db.collection('phoneVerifications').deleteOne({
        _id: verification._id
      });

      return {
        success: true,
        phoneNumber: normalizedNumber
      };
    } catch (error) {
      console.error('Error verifying phone number:', error);
      throw error;
    }
  }

  /**
   * Find friends by contact list
   * @param {string} userId User ID
   * @param {Array<string>} contacts List of contact phone numbers
   * @returns {Promise<Object>} Matched friends and invitable contacts
   */
  async findFriendsByContacts(userId, contacts) {
    try {
      const db = getDb();

      // Normalize and hash all contact numbers
      const normalizedContacts = contacts
        .filter(number => isValidPhoneNumber(number))
        .map(number => {
          const parsed = parsePhoneNumber(number);
          return {
            original: number,
            normalized: parsed.format('E.164'),
            hash: this.hashPhoneNumber(parsed.format('E.164'))
          };
        });

      // Find matching users
      const matchedUsers = await db.collection('users')
        .find({
          phoneNumberHash: { $in: normalizedContacts.map(c => c.hash) },
          _id: { $ne: new ObjectId(userId) },
          phoneVerified: true
        })
        .project({
          _id: 1,
          displayName: 1,
          username: 1,
          profileImage: 1,
          phoneNumberHash: 1
        })
        .toArray();

      // Get matched phone numbers
      const matchedHashes = new Set(matchedUsers.map(user => user.phoneNumberHash));

      // Separate non-matched contacts for potential invites
      const invitableContacts = normalizedContacts
        .filter(contact => !matchedHashes.has(contact.hash))
        .map(contact => contact.normalized);

      return {
        friends: matchedUsers,
        invitableContacts
      };
    } catch (error) {
      console.error('Error finding friends by contacts:', error);
      throw error;
    }
  }

  /**
   * Send app invites to contacts
   * @param {string} userId User ID
   * @param {Array<string>} phoneNumbers List of phone numbers to invite
   * @returns {Promise<Object>} Invite results
   */
  async sendInvites(userId, phoneNumbers) {
    try {
      const db = getDb();
      const results = { sent: [], failed: [] };

      // Get user details for the invite message
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { displayName: 1 } }
      );

      for (const number of phoneNumbers) {
        try {
          // Check if number is valid
          if (!isValidPhoneNumber(number)) {
            results.failed.push({ number, reason: 'Invalid number' });
            continue;
          }

          const parsedNumber = parsePhoneNumber(number);
          const normalizedNumber = parsedNumber.format('E.164');

          // Check rate limits for invites
          const recentInvites = await db.collection('invites').countDocuments({
            phoneNumber: normalizedNumber,
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          });

          if (recentInvites >= 2) {
            results.failed.push({ number, reason: 'Rate limit exceeded' });
            continue;
          }

          // Send invite SMS
          await this.twilioClient.messages.create({
            body: `${user.displayName} invites you to join Rezepta! Download the app: ${process.env.APP_INVITE_URL}`,
            to: normalizedNumber,
            from: process.env.TWILIO_PHONE_NUMBER
          });

          // Record the invite
          await db.collection('invites').insertOne({
            senderId: new ObjectId(userId),
            phoneNumber: normalizedNumber,
            createdAt: new Date()
          });

          results.sent.push(normalizedNumber);
        } catch (error) {
          console.error('Error sending invite:', error);
          results.failed.push({ number, reason: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending invites:', error);
      throw error;
    }
  }

  /**
   * Hash phone number for privacy
   * @param {string} phoneNumber Phone number to hash
   * @returns {string} Hashed phone number
   */
  hashPhoneNumber(phoneNumber) {
    return crypto
      .createHash('sha256')
      .update(phoneNumber + process.env.PHONE_HASH_SALT)
      .digest('hex');
  }
}

export default new ContactManager(); 
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class TwoFactorAuthService {
  async setupTwoFactor(userId) {
    const secret = speakeasy.generateSecret({
      name: `Rezepta:${userId}`,
      issuer: 'Rezepta'
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      speakeasy.generateSecret({ length: 10 }).base32
    );

    // Hash backup codes before storing
    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    // Store secret and backup codes
    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          'two_factor': {
            secret: secret.base32,
            backup_codes: hashedBackupCodes,
            enabled: false,
            setup_pending: true
          }
        }
      }
    );

    return {
      qrCode: qrCodeUrl,
      backupCodes,
      secret: secret.base32
    };
  }

  async verifyAndEnableTwoFactor(userId, token) {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) }
    );

    if (!user.two_factor || !user.two_factor.secret) {
      throw new Error('2FA setup not initiated');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor.secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 30 seconds window
    });

    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    // Enable 2FA
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          'two_factor.enabled': true,
          'two_factor.setup_pending': false,
          'two_factor.verified_at': new Date()
        }
      }
    );

    return true;
  }

  async verifyToken(userId, token) {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) }
    );

    if (!user.two_factor?.enabled) {
      throw new Error('2FA not enabled');
    }

    // Check if it's a backup code
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const isBackupCode = user.two_factor.backup_codes.includes(hashedToken);

    if (isBackupCode) {
      // Remove used backup code
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $pull: {
            'two_factor.backup_codes': hashedToken
          }
        }
      );
      return true;
    }

    // Verify TOTP
    return speakeasy.totp.verify({
      secret: user.two_factor.secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
  }

  async disableTwoFactor(userId, token) {
    const isValid = await this.verifyToken(userId, token);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: { two_factor: "" }
      }
    );

    return true;
  }

  async generateNewBackupCodes(userId, token) {
    const isValid = await this.verifyToken(userId, token);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    const backupCodes = Array.from({ length: 10 }, () => 
      speakeasy.generateSecret({ length: 10 }).base32
    );

    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    const db = getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          'two_factor.backup_codes': hashedBackupCodes
        }
      }
    );

    return backupCodes;
  }
}

module.exports = new TwoFactorAuthService(); 
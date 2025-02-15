import { connectToDatabase } from '../db.js';
import { SecurityAuditService } from '../security-audit.service.js';
import { SecurityAction } from '../types/security.js';
import { generateRecoveryCode } from '../utils/crypto.js';
export class TwoFactorService {
    constructor() {
        this.auditService = SecurityAuditService.getInstance();
    }
    static getInstance() {
        if (!TwoFactorService.instance) {
            TwoFactorService.instance = new TwoFactorService();
        }
        return TwoFactorService.instance;
    }
    async enable2FA(userId, deviceInfo) {
        const db = await connectToDatabase();
        // Generate new TOTP secret
        const secret = generateTOTPSecret();
        const uri = generateTOTPUri(secret, userId.toString());
        const recoveryCodes = Array.from({ length: 8 }, () => generateRecoveryCode());
        // Store in database
        await db.collection('user_2fa').insertOne({
            userId,
            secret,
            recoveryCodes: recoveryCodes.map(code => ({ code, used: false })),
            enabled: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        // Log the action
        await this.auditService.log({
            userId,
            action: SecurityAction.TWO_FACTOR_ENABLE,
            status: 'success',
            deviceInfo,
        });
        return { secret, uri, recoveryCodes };
    }
    async verify2FA(userId, code, deviceInfo) {
        const db = await connectToDatabase();
        const twoFactorData = await db.collection('user_2fa').findOne({ userId });
        if (!twoFactorData || !twoFactorData.secret) {
            return false;
        }
        const isValid = verifyTOTP(code, twoFactorData.secret);
        // Log the verification attempt
        await this.auditService.log({
            userId,
            action: SecurityAction.TWO_FACTOR_VERIFY,
            status: isValid ? 'success' : 'failure',
            deviceInfo,
        });
        return isValid;
    }
    async disable2FA(userId, deviceInfo) {
        const db = await connectToDatabase();
        const result = await db.collection('user_2fa').deleteOne({ userId });
        if (result.deletedCount === 0) {
            return false;
        }
        // Log the action
        await this.auditService.log({
            userId,
            action: SecurityAction.TWO_FACTOR_DISABLE,
            status: 'success',
            deviceInfo,
        });
        return true;
    }
}
//# sourceMappingURL=two-factor.service.js.map
export declare class TwoFactorService {
    private static instance;
    private auditService;
    private constructor();
    static getInstance(): TwoFactorService;
    enable2FA(userId: ObjectId, deviceInfo: any): Promise<{
        secret: string;
        uri: string;
        recoveryCodes: string[];
    }>;
    verify2FA(userId: ObjectId, code: string, deviceInfo: any): Promise<boolean>;
    disable2FA(userId: ObjectId, deviceInfo: any): Promise<boolean>;
}

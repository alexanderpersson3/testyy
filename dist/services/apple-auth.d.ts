interface AppleUser {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
}
export declare function verifyAppleToken(token: string): Promise<AppleUser>;
export {};
//# sourceMappingURL=apple-auth.d.ts.map
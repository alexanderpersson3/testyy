interface GoogleUser {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
}
export declare function verifyGoogleToken(token: string): Promise<GoogleUser>;
export {};

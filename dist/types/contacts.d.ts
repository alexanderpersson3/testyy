export interface PhoneContact {
    phoneNumber: string;
    name?: string;
    email?: string;
}
export interface SocialContact {
    platform: 'facebook' | 'instagram';
    platformUserId: string;
    name: string;
    email?: string;
    avatar?: string;
}
export interface ContactMatch {
    userId: ObjectId;
    username: string;
    displayName: string;
    avatar?: string;
    matchType: 'phone' | 'email' | 'social';
    platform?: 'facebook' | 'instagram';
}
export interface ContactImportResult {
    matches: ContactMatch[];
    totalContacts: number;
}
export interface FacebookAuthConfig {
    appId: string;
    appSecret: string;
    redirectUri: string;
    scope: string[];
}
export interface InstagramAuthConfig {
    appId: string;
    appSecret: string;
    redirectUri: string;
    scope: string[];
}
export interface SocialAuthToken {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken?: string;
    scope?: string[];
    userId?: string;
}

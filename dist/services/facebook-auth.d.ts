interface FacebookUser {
    id: string;
    email: string;
    name?: string;
    picture?: {
        data: {
            url: string;
        };
    };
}
export declare function verifyFacebookToken(token: string): Promise<FacebookUser>;
export {};

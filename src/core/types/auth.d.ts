interface TokenPayload {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
}

declare module '../../services/google-auth.js' {
  export function verifyGoogleToken(token: string): Promise<TokenPayload>;
}

declare module '../../services/facebook-auth.js' {
  export function verifyFacebookToken(token: string): Promise<TokenPayload>;
}

declare module '../../services/apple-auth.js' {
  export function verifyAppleToken(token: string): Promise<TokenPayload>;
}

export {};

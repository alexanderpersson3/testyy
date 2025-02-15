declare module 'zxcvbn' {
  export interface ZXCVBNFeedback {
    warning: string;
    suggestions: string[];
  }

  export interface ZXCVBNResult {
    score: number;
    feedback: ZXCVBNFeedback;
  }

  export default function zxcvbn(password: string): ZXCVBNResult;
}

declare module 'speakeasy' {
  export interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  }

  export interface TOTPVerifyOptions {
    secret: string;
    encoding: 'base32' | 'ascii' | 'hex';
    token: string;
    window?: number;
  }

  export interface GenerateSecretOptions {
    name?: string;
    length?: number;
  }

  export const totp: {
    verify: (options: TOTPVerifyOptions) => boolean;
  };

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
}

declare module 'ioredis' {
  import { EventEmitter } from 'events';

  interface RedisCommands {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK'>;
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    del(key: string | string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    mget(keys: string[]): Promise<(string | null)[]>;
    info(): Promise<string>;
    dbsize(): Promise<number>;
  }

  class Redis extends EventEmitter implements RedisCommands {
    constructor(options?: Redis.RedisOptions);
    constructor(port?: number, host?: string, options?: Redis.RedisOptions);
    constructor(host?: string, options?: Redis.RedisOptions);
    constructor(url: string, options?: Redis.RedisOptions);

    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK'>;
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    del(key: string | string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    mget(keys: string[]): Promise<(string | null)[]>;
    info(): Promise<string>;
    dbsize(): Promise<number>;
  }

  namespace Redis {
    interface RedisOptions {
      port?: number;
      host?: string;
      username?: string;
      password?: string;
      db?: number;
      [key: string]: any;
    }
  }

  export = Redis;
} 
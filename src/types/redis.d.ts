import { Redis as IoRedis } from 'ioredis';

declare module 'ioredis' {
  interface Redis extends IoRedis {
    keys(pattern: string): Promise<string[]>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    info(): Promise<string>;
    dbsize(): Promise<number>;
  }
} 
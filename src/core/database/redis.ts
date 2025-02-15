import Redis from 'ioredis';

class RedisClient extends Redis {
  constructor(url?: string) {
    super(url || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async keys(pattern: string): Promise<string[]> {
    return super.keys(pattern);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return super.mget(keys);
  }

  async info(): Promise<string> {
    return super.info();
  }

  async dbsize(): Promise<number> {
    return super.dbsize();
  }
}

export const redis = new RedisClient();
export default redis; 
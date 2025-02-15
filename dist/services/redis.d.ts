import Redis from 'ioredis';
declare class RedisClient {
    private client;
    constructor();
    getClient(): Redis;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expireSeconds?: number): Promise<'OK'>;
    del(key: string): Promise<number>;
    clear(): Promise<'OK'>;
    disconnect(): Promise<void>;
}
declare const redisClientInstance: RedisClient;
export declare const redis: Redis;
export default redisClientInstance;

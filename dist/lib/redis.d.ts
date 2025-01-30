declare class RedisClient {
    private client;
    private static instance;
    private constructor();
    static getInstance(): RedisClient;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK'>;
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    del(key: string): Promise<number>;
    flushdb(): Promise<'OK'>;
    disconnect(): Promise<void>;
}
export declare const redis: RedisClient;
export {};
//# sourceMappingURL=redis.d.ts.map
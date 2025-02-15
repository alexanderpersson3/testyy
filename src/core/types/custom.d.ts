declare module 'express-rate-limit' {

  interface Options {
    windowMs?: number;
    max?: number;
    message?: string | object;
    statusCode?: number;
    headers?: boolean;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (req: Request) => string;
    handler?: (req: Request, res: Response, next: NextFunction) => void;
    skip?: (req: Request, res: Response) => boolean;
    standardHeaders?: boolean;
  }

  function rateLimit(options?: Options): (req: Request, res: Response, next: NextFunction) => void;
  export = rateLimit;
}

declare module 'i18next-fs-backend' {
  import { BackendModule } from 'i18next';;
  const backend: BackendModule;
  export = backend;
}

declare module 'ioredis' {
  import { EventEmitter } from 'events';;

  interface RedisOptions {
    port?: number;
    host?: string;
    username?: string;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    enableReadyCheck?: boolean;
    connectTimeout?: number;
    disconnectTimeout?: number;
    retryStrategy?: (times: number) => number | void | null;
    reconnectOnError?: (error: Error) => boolean | 1 | 2;
    maxLoadingRetryTime?: number;
  }

  class Redis extends EventEmitter {
    constructor(options?: RedisOptions);
    constructor(port?: number, host?: string, options?: RedisOptions);
    constructor(url: string, options?: RedisOptions);

    connect(): Promise<void>;
    disconnect(): void;
    quit(): Promise<'OK'>;

    // Key-value operations
    get(key: string): Promise<string | null>;
    set(key: string, value: string | number, mode?: string, duration?: number): Promise<'OK'>;
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    del(key: string | string[]): Promise<number>;
    exists(key: string | string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    flushdb(): Promise<'OK'>;

    // Hash operations
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string | number): Promise<number>;
    hdel(key: string, field: string | string[]): Promise<number>;
    hgetall(key: string): Promise<{ [key: string]: string }>;

    // List operations
    lpush(key: string, ...values: (string | number)[]): Promise<number>;
    rpush(key: string, ...values: (string | number)[]): Promise<number>;
    lpop(key: string): Promise<string | null>;
    rpop(key: string): Promise<string | null>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;

    // Set operations
    sadd(key: string, ...members: (string | number)[]): Promise<number>;
    srem(key: string, ...members: (string | number)[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sismember(key: string, member: string | number): Promise<number>;

    // Sorted set operations
    zadd(key: string, score: number, member: string): Promise<number>;
    zrem(key: string, ...members: string[]): Promise<number>;
    zrange(key: string, start: number, stop: number, withScores?: 'WITHSCORES'): Promise<string[]>;
    zrevrange(
      key: string,
      start: number,
      stop: number,
      withScores?: 'WITHSCORES'
    ): Promise<string[]>;

    // Transaction operations
    multi(): Pipeline;
    pipeline(): Pipeline;
    exec(): Promise<Array<[Error | null, any]>>;
  }

  class Pipeline {
    exec(): Promise<Array<[Error | null, any]>>;
  }

  export = Redis;
}

declare module 'memory-cache' {
  interface Cache {
    put(key: string, value: any, duration?: number): void;
    get(key: string): any;
    del(key: string): void;
    clear(): void;
  }

  const cache: Cache;
  export = cache;
}

declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function PDFParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export = PDFParse;
}

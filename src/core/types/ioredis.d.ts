declare module 'ioredis' {
  interface RedisOptions {
    name?: string;
    [key: string]: any;
  }

  interface ClusterOptions {
    scaleReads?: string;
    clusterRetryStrategy?: (times: number) => number;
    [key: string]: any;
  }

  class Redis {
    options: RedisOptions;
    info(section?: string): Promise<string>;
    ping(): Promise<string>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: string, duration: number): Promise<'OK'>;
    del(...keys: string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    disconnect(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  class Cluster extends Redis {
    constructor(nodes: { host: string; port: number }[], options?: ClusterOptions);
    nodes(role?: 'master' | 'slave'): Promise<Redis[]>;
  }

  interface RedisConstructor {
    new (): Redis;
    new (options: RedisOptions): Redis;
    new (port: number, host: string, options?: RedisOptions): Redis;
    Cluster: typeof Cluster;
  }

  const Redis: RedisConstructor;
  export = Redis;
} 
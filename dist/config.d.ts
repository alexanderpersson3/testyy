export declare const config: {
    mongodb: {
        uri: string;
        dbName: string;
    };
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    rateLimiting: {
        windowMs: number;
        max: number;
    };
    cors: {
        origin: string[];
    };
    server: {
        port: number;
        env: string;
    };
    gcp: {
        projectId: string;
        keyFilePath: string;
        storageBucket: string;
    };
};
//# sourceMappingURL=config.d.ts.map
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
    email: {
        host: string;
        port: string;
        secure: boolean;
        user: string;
        password: string;
    };
    server: {
        port: number;
        env: string;
        fallbackPorts: number[];
    };
    gcp: {
        projectId: string;
        keyFilePath: string;
        storageBucket: string;
    };
};
export default config;

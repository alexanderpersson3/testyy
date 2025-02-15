/**
 * Application configuration module that centralizes all configurable settings.
 * Supports environment-specific configuration through environment variables
 * while providing sensible defaults for development.
 *
 * @module config
 */
export interface Config {
    elasticsearch: {
        url: string;
        username: string;
        password: string;
    };
    mongodb: {
        uri: string;
        dbName: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
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
        origin: string | string[];
        credentials: boolean;
    };
    server: {
        port: number;
        host: string;
    };
    gcp: {
        projectId: string;
        bucket: string;
    };
}
export declare const config: Config;
export default config;

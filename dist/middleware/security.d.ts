import express from 'express';
import type { Request, Response, NextFunction } from '../types/index.js';
export declare class AppError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}
export declare const setupSecurity: (app: express.Application) => void;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimiter: (maxSize?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => any;
export declare const xssProtection: (req: Request, res: Response, next: NextFunction) => any;

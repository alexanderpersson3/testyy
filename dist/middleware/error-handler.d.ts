import { Request, Response, NextFunction } from 'express';
export interface AppErrorOptions {
    message: string;
    statusCode: number;
    isOperational?: boolean;
    stack?: string;
}
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly status: string;
    readonly isOperational: boolean;
    constructor(statusCode: number, message: string);
}
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error-handler.d.ts.map
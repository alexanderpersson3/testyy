export declare class AppError extends Error {
    message: string;
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
export default errorHandler;

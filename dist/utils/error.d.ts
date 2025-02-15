export declare class AppError extends Error {
    status: string;
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, status: string | number);
}
export declare const handleError: (err: Error | AppError) => {
    status: string;
    message: string;
};

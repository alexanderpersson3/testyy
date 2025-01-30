export class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(400, message);
};
const handleDuplicateFieldsDB = (err) => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)?.[0] || '';
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(400, message);
};
const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(400, message);
};
const handleJWTError = () => new AppError(401, 'Invalid token. Please log in again!');
const handleJWTExpiredError = () => new AppError(401, 'Your token has expired! Please log in again.');
const handleZodError = (err) => {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return new AppError(400, `Validation failed. ${message}`);
};
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};
const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message
        });
    }
    else {
        console.error('ERROR 💥', err);
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went wrong!'
        });
    }
};
export const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.name,
                message: err.message,
                status: err.status
            }
        });
        return;
    }
    // Handle other types of errors
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            status: 'error'
        }
    });
};
//# sourceMappingURL=error-handler.js.map
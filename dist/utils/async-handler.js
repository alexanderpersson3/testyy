import { AppError } from './error-handler.js';
/**
 * Wraps an async request handler to properly handle Promise rejections
 * and provide correct TypeScript types
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch(err => {
            // Convert unknown errors to AppError
            if (!(err instanceof AppError)) {
                console.error('Unhandled error in route handler:', err);
                err = new AppError('An unexpected error occurred', 500);
            }
            next(err);
        });
    };
};
//# sourceMappingURL=async-handler.js.map
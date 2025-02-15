/**
 * Middleware to handle validation errors
 */
export declare function validationMiddleware(req: Request, res: Response, next: NextFunction): any;
/**
 * Validation error handler middleware
 */
export declare function validationErrorHandler(error: Error, req: Request, res: Response, next: NextFunction): any;

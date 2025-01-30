import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
export interface ValidationConfig {
    body?: AnyZodObject;
    query?: AnyZodObject;
    params?: AnyZodObject;
}
export declare const validateRequest: (schemas: ValidationConfig) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const validate: (schemas: ValidationConfig) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=validation.d.ts.map
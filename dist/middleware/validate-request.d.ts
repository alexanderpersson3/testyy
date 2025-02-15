import { z } from 'zod';
export interface ValidationSchema {
    body?: z.ZodType<any>;
    query?: z.ZodType<any>;
    params?: z.ZodType<any>;
}
export declare const validateRequest: (schema: z.ZodType<any> | ValidationSchema) => (req: Request, res: Response, next: NextFunction) => Promise<void>;

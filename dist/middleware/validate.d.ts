import { ZodType } from 'zod';
export declare const validate: (schema: ZodType<any, any, any>, source?: "body" | "query" | "params", errorMessage?: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;

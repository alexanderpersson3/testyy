import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../types/auth';
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=require-auth.d.ts.map
import type { Request, Response, NextFunction } from '../types/index.js';
import type { AuthUser } from '../types/index.js';
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<any>;

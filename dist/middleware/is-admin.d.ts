import type { Request, Response, NextFunction } from '../types/index.js';
import type { AuthenticatedRequest } from '../types/index.js';
export declare const isAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const isAdminOrModerator: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function checkIsAdmin(userId: string): Promise<boolean>;

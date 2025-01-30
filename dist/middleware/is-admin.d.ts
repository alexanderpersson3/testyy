import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/middleware.js';
export declare function isAdmin(userId: string): Promise<boolean>;
export declare const isAdminHandler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export default function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=is-admin.d.ts.map
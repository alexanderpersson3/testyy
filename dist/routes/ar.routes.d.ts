import { AuthUser } from '../types/auth.js';
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
declare const router: import("express-serve-static-core").Router;
export default router;

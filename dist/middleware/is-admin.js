import { ObjectId } from 'mongodb';
;
import { AppError } from '../utils/error.js';
import { UserRole } from '../types/auth.js';
export const isAdmin = async (req, res, next) => {
    try {
        const authReq = req;
        if (!authReq.user) {
            throw new AppError('Authentication required', 401);
        }
        const user = await getCollection('users').findOne({
            _id: new ObjectId(authReq.user.id)
        });
        if (!user || user.role !== UserRole.ADMIN) {
            throw new AppError('Admin access required', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
export const isAdminOrModerator = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }
        const user = await getCollection('users').findOne({
            _id: new ObjectId(req.user.id)
        });
        if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)) {
            throw new AppError('Admin or moderator access required', 403);
        }
        next();
    }
    catch (error) {
        next(error instanceof AppError ? error : new AppError('Error checking admin access', 500));
    }
};
export async function checkIsAdmin(userId) {
    const user = await getCollection('users')
        .findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });
    return user?.role === UserRole.ADMIN;
}
//# sourceMappingURL=is-admin.js.map
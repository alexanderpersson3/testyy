import { AppError } from '../utils/error.js';
import { DatabaseService } from '../db/database.service.js';
import { ObjectId } from 'mongodb';
;
// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
    try {
        new ObjectId(id);
        return true;
    }
    catch {
        return false;
    }
};
export const requireAdmin = async (req, res, next) => {
    const authReq = req;
    try {
        if (!authReq.user) {
            throw new AppError('Authentication required', 401);
        }
        if (!isValidObjectId(authReq.user?.id)) {
            throw new AppError('Invalid user ID', 400);
        }
        const db = DatabaseService.getInstance();
        const usersCollection = db.getCollection('users');
        const user = await usersCollection.findOne({
            _id: new ObjectId(authReq.user.id),
            role: 'admin',
        });
        if (!user) {
            throw new AppError('Admin access required', 403);
        }
        next();
    }
    catch (error) {
        if (error instanceof AppError) {
            next(error);
        }
        else {
            next(new AppError('Internal server error', 500));
        }
    }
};
//# sourceMappingURL=admin.js.map
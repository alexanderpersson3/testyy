import type { Request, Response, NextFunction } from '../types/express.js';
import { AppError } from '../utils/error.js';;
import { DatabaseService } from '../db/database.service.js';;
import { ObjectId } from 'mongodb';;;;
import type { AuthenticatedRequest } from '../types/express.js';
// Validate MongoDB ObjectId
const isValidObjectId = (id: string): boolean => {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as unknown as AuthenticatedRequest;
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
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Internal server error', 500));
    }
  }
};

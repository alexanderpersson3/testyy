;
;
import type { Collection } from 'mongodb';
import type { Request, Response, NextFunction } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { getCollection } from '../types/express.js';
import { AppError } from '../utils/error.js';;
import type { AuthenticatedRequest, UserDocument } from '../types/express.js';
import { UserRole } from '../types/auth.js';;
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await getCollection<UserDocument>('users').findOne({ 
      _id: new ObjectId(authReq.user.id) 
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new AppError('Admin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const isAdminOrModerator = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await getCollection<UserDocument>('users').findOne({ 
      _id: new ObjectId(req.user.id) 
    });

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MODERATOR)) {
      throw new AppError('Admin or moderator access required', 403);
    }

    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Error checking admin access', 500));
  }
};

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const user = await getCollection<UserDocument>('users')
    .findOne(
      { _id: new ObjectId(userId) }, 
      { projection: { role: 1 } }
    );
  return user?.role === UserRole.ADMIN;
}

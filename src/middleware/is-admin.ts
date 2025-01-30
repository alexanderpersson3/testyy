import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { AppError } from './error-handler.js';
import { AuthenticatedRequest } from '../types/middleware.js';

export async function isAdmin(userId: string): Promise<boolean> {
  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1 } }
  );
  return user?.role === 'admin';
}

export const isAdminHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    if (req.user.role !== 'admin') {
      next(new AppError(403, 'Admin access required'));
      return;
    }

    next();
  } catch (err) {
    next(new AppError(500, 'Error checking admin access'));
  }
};

export default async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    const isUserAdmin = await isAdmin(req.user.id);
    if (!isUserAdmin) {
      next(new AppError(403, 'Admin access required'));
      return;
    }

    next();
  } catch (err) {
    console.error('Admin check error:', err);
    next(new AppError(500, 'Error checking admin access'));
  }
} 
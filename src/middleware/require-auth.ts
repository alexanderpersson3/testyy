import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { AuthUser, CustomJwtPayload } from '../types/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as CustomJwtPayload;
    const objectId = new ObjectId(payload.id);
    
    req.user = {
      _id: objectId,
      id: objectId.toString(),
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}; 

import type { Request, Response, NextFunction } from '../types/express.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';;;;
import type { AuthUser, TokenPayload } from '../types/express.js';

// Extend Express Request type to include our user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;
    const objectId = new ObjectId(payload.id);

    // Cast to AuthUser to match the extended Express.Request interface
    (req as Express.Request).user = {
      _id: objectId,
      id: objectId.toString(),
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

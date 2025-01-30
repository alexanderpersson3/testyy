import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken, TokenPayload } from '../utils/auth.js';
import { AuthUser } from '../types/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    req.user = {
      _id: new ObjectId(decoded.id),
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
}

export function requireModerator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Moderator access required'
    });
  }
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        _id: new ObjectId(decoded.id),
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };
    }
    next();
  } catch (error) {
    // Invalid token, but continue without user
    next();
  }
}

// Alias for backward compatibility
export const auth = requireAuth;
export const authenticateToken = requireAuth;
export const requireRole = (role: 'user' | 'admin' | 'moderator') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (role === 'moderator' && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Moderator access required'
      });
    }

    next();
  };
}; 
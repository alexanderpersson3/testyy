import { NextFunction } from 'express'
import { Types } from 'mongoose'
import { config } from '@/config'
import { UnauthorizedError } from '@/core/errors/unauthorized.error'
import { UserRole } from '@/core/types/enums'
import { JwtUser } from '@/core/types/auth.types'
import { TypedRequest, TypedResponse, TypedAuthRequest, RequestWithAuth } from '@/types/express'
import jwt from 'jsonwebtoken';

// Token payload from JWT
export interface JwtPayload {
  _id: string;
  email: string;
  username: string;
  role: UserRole;
  roles?: UserRole[];
}

// Type guard to check if request is authenticated
function isAuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
  req: TypedRequest<P, ResBody, ReqBody, ReqQuery>
): req is RequestWithAuth<P, ResBody, ReqBody, ReqQuery> {
  return 'user' in req && req.user !== undefined;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
  req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
  _res: TypedResponse<ResBody>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    if (!decoded) {
      throw new UnauthorizedError('Invalid token');
    }

    const { _id, email, username, role, roles } = decoded;
    if (!_id || !email || !username || !role) {
      throw new UnauthorizedError('Invalid token payload: Missing required fields');
    }

    // Convert string _id to ObjectId and create user object
    const objectId = new Types.ObjectId(_id);
    const user: JwtUser = {
      _id: objectId,
      id: objectId.toHexString(),
      userId: _id,
      email,
      username,
      role,
      roles: roles || [role],
      permissions: [],
      iat: undefined,
      exp: undefined,
      sub: undefined,
      requires2FA: false
    };

    // Attach user to request and convert to RequestWithAuth
    (req as RequestWithAuth<P, ResBody, ReqBody, ReqQuery>).user = user;
    next();
  } catch (error) {
    next(new UnauthorizedError(
      `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
    ));
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(allowedRoles: UserRole[]) => (
  req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
  _res: TypedResponse<ResBody>,
  next: NextFunction
): void => {
  if (!isAuthenticatedRequest(req)) {
    next(new UnauthorizedError('User not authenticated'));
    return;
  }

  const userRoles = req.user.roles;
  const hasPermission = allowedRoles.some(role => userRoles.includes(role));

  if (!hasPermission) {
    next(new UnauthorizedError(
      `Insufficient permissions: Required roles [${allowedRoles.join(', ')}]`
    ));
    return;
  }

  next();
};

// Convenience exports
export const auth = authenticate;
export const requireRole = authorize; 
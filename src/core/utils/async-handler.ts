import { Response, NextFunction } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { Types } from 'mongoose'
import { JwtUser } from '@/core/types/auth.types'
import { ApiResponse } from '@/core/types/api.types'
import { AuthorizationError } from '@/core/errors/base.error'
import { TypedAuthRequest, TypedResponse, TypedRequest, TypedAuthHandler, RequestWithAuth } from '@/types/express'
import { UserRole } from '@/core/types/enums'

/**
 * Wraps an async function to be used as Express middleware
 * Automatically catches errors and passes them to next()
 */
export const asyncHandler = <
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs
>(
  fn: (
    req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
    res: TypedResponse<ResBody>,
    next: NextFunction
  ) => Promise<void> | void
) => {
  return async (
    req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
    res: TypedResponse<ResBody>,
    next: NextFunction
  ) => {
    try {
      await fn(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Higher-order function that wraps an authenticated request handler
 * Ensures req.user exists and is properly typed before executing the handler
 */
export const authenticatedHandler = <
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs
>(
  handler: TypedAuthHandler<P, ResBody, ReqBody, ReqQuery>
): TypedAuthHandler<P, ResBody, ReqBody, ReqQuery> => {
  return async (
    req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
    res: TypedResponse<ResBody>,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('No user found')
      }

      // Convert user to proper JwtUser type
      const user: JwtUser = {
        _id: typeof req.user._id === 'string' ? new Types.ObjectId(req.user._id) : req.user._id,
        id: req.user.id,
        userId: req.user.id, // Use id as userId
        email: req.user.email,
        username: req.user.email.split('@')[0], // Default to email prefix if username not provided
        role: req.user.role as UserRole, // Cast to UserRole enum
        roles: [req.user.role as UserRole], // Cast to UserRole enum array
        permissions: req.user.permissions || [], // Default to empty permissions
        iat: undefined,
        exp: undefined,
        sub: undefined,
        requires2FA: false
      }

      // Create a new request object with the proper user type
      const typedReq = Object.create(req) as RequestWithAuth<P, ResBody, ReqBody, ReqQuery>
      typedReq.user = user

      await handler(typedReq as TypedAuthRequest<P, ResBody, ReqBody, ReqQuery>, res, next)
    } catch (error) {
      next(error)
    }
  }
}

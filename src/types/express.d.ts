import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      token?: string;
      requires2FA?: boolean;
    }
  }
} 
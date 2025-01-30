import { AuthenticatedRequest } from './auth';
import { Express } from 'express-serve-static-core';

export interface FileRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
} 
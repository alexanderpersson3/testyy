import type { Express } from '../types/express.js';;

export interface FileRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

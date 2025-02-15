import type { Request } from '../types/express.js';
import multer from 'multer';

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

// Configure multer for memory storage
const multerStorage = (multer as any).memoryStorage();
const uploadConfig = {
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Maximum 1 file per request
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
};

// Cast multer instance to any to avoid type issues with CommonJS/ESM interop
export const upload = multer(uploadConfig) as any;

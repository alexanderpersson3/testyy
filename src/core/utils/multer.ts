import { promises as fs } from 'fs';;
import type { Request } from '../types/express.js';
import multer from 'multer';
import path from 'path';
import { promisify } from 'util';;

const mkdir = promisify(fs.mkdir);

// Ensure uploads directory exists
const createUploadsDir = async () => {
  const dir = 'uploads/recipes';
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

// Create uploads directory
createUploadsDir().catch(console.error);

// Configure multer for recipe image uploads
const multerOptions = {
  dest: 'uploads/recipes',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
};

// Create multer instance
const upload = multer(multerOptions);

// Export middleware for single file upload
export const recipeImageUpload = upload;

import { promises as fs } from 'fs';;
import path from 'path';
import logger from '../utils/logger.js';

const REQUIRED_DIRECTORIES = [
  'uploads',
  'uploads/temp',
  'uploads/thumbnails',
  'uploads/videos',
];

export async function initializeDirectories(): Promise<void> {
  try {
    for (const dir of REQUIRED_DIRECTORIES) {
      const dirPath = path.join(process.cwd(), dir);
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  } catch (error) {
    logger.error('Failed to create required directories:', error);
    throw error;
  }
}

export async function cleanupTempFiles(): Promise<void> {
  try {
    const tempDir = path.join(process.cwd(), 'uploads/temp');
    const files = await fs.readdir(tempDir);
    
    const deletePromises = files.map(file => 
      fs.unlink(path.join(tempDir, file))
        .catch(error => {
          logger.error(`Failed to delete temp file ${file}:`, error);
        })
    );

    await Promise.all(deletePromises);
    logger.info('Cleaned up temporary files');
  } catch (error) {
    logger.error('Failed to cleanup temporary files:', error);
    // Don't throw here as this is not critical
  }
} 
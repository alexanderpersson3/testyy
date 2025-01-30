import { Storage } from '@google-cloud/storage';
import { config } from '../config';

export class ImageService {
  private storage: Storage;
  private bucket: string;
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor() {
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFilePath
    });
    this.bucket = config.gcp.storageBucket;
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    // Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.');
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 5MB.');
    }

    try {
      const bucket = this.storage.bucket(this.bucket);
      const blob = bucket.file(`images/${Date.now()}-${file.originalname}`);
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype
        }
      });

      return new Promise<string>((resolve, reject) => {
        blobStream.on('error', (error: Error) => {
          reject(new Error(`Failed to upload image: ${error.message}`));
        });

        blobStream.on('finish', () => {
          const publicUrl = `https://storage.googleapis.com/${this.bucket}/${blob.name}`;
          resolve(publicUrl);
        });

        blobStream.end(file.buffer);
      });
    } catch (error) {
      throw new Error(`Failed to upload image: ${(error as Error).message}`);
    }
  }

  async deleteImage(url: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const fileName = url.split('/').pop();
      
      if (!fileName) {
        throw new Error('Invalid image URL');
      }

      const file = bucket.file(`images/${fileName}`);
      await file.delete();
    } catch (error) {
      throw new Error(`Failed to delete image: ${(error as Error).message}`);
    }
  }
} 
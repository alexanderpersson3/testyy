import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';
export class ImageService {
    constructor() {
        this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
        this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        this.storage = new Storage({
            projectId: config.gcp.projectId,
            keyFilename: config.gcp.keyFilePath,
        });
        this.bucket = config.gcp.storageBucket;
    }
    async uploadImage(file) {
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
                    contentType: file.mimetype,
                },
            });
            return new Promise((resolve, reject) => {
                blobStream.on('error', (error) => {
                    reject(new Error(`Failed to upload image: ${error.message}`));
                });
                blobStream.on('finish', () => {
                    const publicUrl = `https://storage.googleapis.com/${this.bucket}/${blob.name}`;
                    resolve(publicUrl);
                });
                blobStream.end(file.buffer);
            });
        }
        catch (error) {
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }
    async deleteImage(url) {
        try {
            const bucket = this.storage.bucket(this.bucket);
            const fileName = url.split('/').pop();
            if (!fileName) {
                throw new Error('Invalid image URL');
            }
            const file = bucket.file(`images/${fileName}`);
            await file.delete();
        }
        catch (error) {
            throw new Error(`Failed to delete image: ${error.message}`);
        }
    }
}
//# sourceMappingURL=image-service.js.map
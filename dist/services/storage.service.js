import { Storage } from '@google-cloud/storage';
import path from 'path';
import logger from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
export class StorageService {
    constructor(options) {
        this.storage = new Storage({
            projectId: options.projectId,
            keyFilename: options.keyFilename,
        });
        this.bucketName = options.bucketName;
    }
    static getInstance(options) {
        if (!StorageService.instance) {
            if (!options) {
                throw new Error('Storage service must be initialized with options');
            }
            StorageService.instance = new StorageService(options);
        }
        return StorageService.instance;
    }
    async uploadFile(filePath, destination, options = {}) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const [file] = await bucket.upload(filePath, {
                destination,
                metadata: {
                    metadata: options.metadata,
                },
            });
            if (options.public) {
                await file.makePublic();
            }
            return file.publicUrl();
        }
        catch (error) {
            logger.error('Failed to upload file:', error);
            throw new Error('Failed to upload file to storage');
        }
    }
    async uploadBuffer(buffer, destination, options = {}) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(destination);
            await file.save(buffer, {
                contentType: options.contentType,
                metadata: {
                    metadata: options.metadata,
                },
            });
            if (options.public) {
                await file.makePublic();
            }
            return file.publicUrl();
        }
        catch (error) {
            logger.error('Failed to upload buffer:', error);
            throw new Error('Failed to upload buffer to storage');
        }
    }
    async deleteFile(filePath) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            await bucket.file(filePath).delete();
        }
        catch (error) {
            logger.error('Failed to delete file:', error);
            throw new Error('Failed to delete file from storage');
        }
    }
    async copyFile(sourcePath, destinationPath) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            await bucket.file(sourcePath).copy(bucket.file(destinationPath));
        }
        catch (error) {
            logger.error('Failed to copy file:', error);
            throw new Error('Failed to copy file in storage');
        }
    }
    async generateSignedUrl(filePath, options) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const [url] = await bucket.file(filePath).getSignedUrl({
                version: 'v4',
                action: options.action,
                expires: options.expires,
                contentType: options.contentType,
            });
            return url;
        }
        catch (error) {
            logger.error('Failed to generate signed URL:', error);
            throw new Error('Failed to generate signed URL');
        }
    }
    async getPublicUrl(filePath) {
        const bucket = this.storage.bucket(this.bucketName);
        return bucket.file(filePath).publicUrl();
    }
    async moveFile(sourcePath, destinationPath) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const sourceFile = bucket.file(sourcePath);
            const destinationFile = bucket.file(destinationPath);
            await sourceFile.move(destinationFile);
        }
        catch (error) {
            logger.error('Failed to move file:', error);
            throw new DatabaseError('Failed to move file');
        }
    }
}
//# sourceMappingURL=storage.service.js.map
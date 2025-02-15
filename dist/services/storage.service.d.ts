interface StorageOptions {
    bucketName: string;
    projectId: string;
    keyFilename: string;
}
export declare class StorageService {
    private static instance;
    private storage;
    private bucketName;
    private constructor();
    static getInstance(options?: StorageOptions): StorageService;
    uploadFile(filePath: string, destination: string, options?: {
        public?: boolean;
        metadata?: Record<string, string>;
    }): Promise<string>;
    uploadBuffer(buffer: Buffer, destination: string, options?: {
        public?: boolean;
        contentType?: string;
        metadata?: Record<string, string>;
    }): Promise<string>;
    deleteFile(filePath: string): Promise<void>;
    copyFile(sourcePath: string, destinationPath: string): Promise<void>;
    generateSignedUrl(filePath: string, options: {
        action: 'read' | 'write' | 'delete';
        expires: Date;
        contentType?: string;
    }): Promise<string>;
    getPublicUrl(filePath: string): Promise<string>;
    moveFile(sourcePath: string, destinationPath: string): Promise<void>;
}
export {};

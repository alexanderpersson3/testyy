export declare class ImageService {
    private storage;
    private bucket;
    private readonly ALLOWED_TYPES;
    private readonly MAX_FILE_SIZE;
    constructor();
    uploadImage(file: Express.Multer.File): Promise<string>;
    deleteImage(url: string): Promise<void>;
}
//# sourceMappingURL=image-service.d.ts.map
interface VideoMetadata {
    duration: number;
    format: string;
    resolution: {
        width: number;
        height: number;
    };
}
export declare class ThumbnailService {
    private static instance;
    private readonly THUMBNAILS_DIR;
    private constructor();
    private ensureThumbnailsDir;
    static getInstance(): ThumbnailService;
    generateThumbnail(videoPath: string, timestamp?: number): Promise<string>;
    generateThumbnailGrid(videoPath: string, rows?: number, cols?: number): Promise<string>;
    getVideoMetadata(videoPath: string): Promise<VideoMetadata>;
    cleanup(filePath: string): Promise<void>;
}
export {};

import { ObjectId } from 'mongodb';
interface VideoChapter {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    thumbnailUrl?: string;
}
interface VideoAnnotation {
    id: string;
    time: number;
    text: string;
    position: {
        x: number;
        y: number;
    };
    duration?: number;
}
interface VideoMetadata {
    _id: ObjectId;
    recipeId: ObjectId;
    url: string;
    thumbnailUrl: string;
    thumbnailGridUrl: string;
    duration: number;
    format: string;
    resolution: {
        width: number;
        height: number;
    };
    timestamps: Array<{
        time: number;
        label: string;
        description: string;
    }>;
    chapters: VideoChapter[];
    annotations: VideoAnnotation[];
    subtitles?: string;
    createdAt: Date;
    updatedAt: Date;
}
interface VideoUploadOptions {
    recipeId: string;
    timestamps?: Array<{
        time: number;
        label: string;
        description: string;
    }>;
    subtitles?: string;
}
export declare class VideoService {
    private static instance;
    private readonly COLLECTION;
    private readonly TEMP_DIR;
    private db;
    private thumbnailService;
    private storageService;
    private constructor();
    private ensureTempDir;
    static getInstance(): VideoService;
    private getCollection;
    private uploadThumbnail;
    private uploadVideo;
    uploadVideoWithMetadata(videoBuffer: Buffer, filename: string, options: VideoUploadOptions): Promise<VideoMetadata>;
    getVideo(videoId: string): Promise<VideoMetadata | null>;
    getVideosByRecipe(recipeId: string): Promise<VideoMetadata[]>;
    updateTimestamps(videoId: string, timestamps: VideoMetadata['timestamps']): Promise<void>;
    updateSubtitles(videoId: string, subtitlesUrl: string): Promise<void>;
    deleteVideo(videoId: string): Promise<void>;
    addChapter(videoId: string, chapter: Omit<VideoChapter, 'id' | 'thumbnailUrl'>): Promise<VideoChapter>;
    updateChapter(videoId: string, chapterId: string, updates: Partial<Omit<VideoChapter, 'id'>>): Promise<void>;
    deleteChapter(videoId: string, chapterId: string): Promise<void>;
    addAnnotation(videoId: string, annotation: Omit<VideoAnnotation, 'id'>): Promise<VideoAnnotation>;
    updateAnnotation(videoId: string, annotationId: string, updates: Partial<Omit<VideoAnnotation, 'id'>>): Promise<void>;
    deleteAnnotation(videoId: string, annotationId: string): Promise<void>;
    private downloadVideoSegment;
    uploadSubtitles(videoId: string, subtitlesContent: string, extension: string): Promise<string>;
    private convertSrtToVtt;
    getVideoMetadata(videoId: string): Promise<{
        duration: number;
        format: string;
        resolution: {
            width: number;
            height: number;
        };
        thumbnails: {
            default: string;
            grid: string;
        };
        subtitles?: string;
        timestamps: Array<{
            time: number;
            label: string;
            description: string;
        }>;
        chapters: VideoChapter[];
        annotations: VideoAnnotation[];
    }>;
}
export {};

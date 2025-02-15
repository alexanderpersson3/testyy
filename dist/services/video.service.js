import * as fs from 'fs';
import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { DatabaseError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ThumbnailService } from '../thumbnail.service.js';
import path from 'path';
import { spawn } from 'child_process';
import { StorageService } from '../storage.service.js';
export class VideoService {
    constructor() {
        this.COLLECTION = 'recipe_videos';
        this.TEMP_DIR = path.join(process.cwd(), 'temp');
        this.db = DatabaseService.getInstance();
        this.thumbnailService = ThumbnailService.getInstance();
        this.storageService = StorageService.getInstance({
            bucketName: process.env.GCS_BUCKET_NAME || 'rezepta-media',
            projectId: process.env.GCS_PROJECT_ID || '',
            keyFilename: process.env.GCS_KEY_FILE || 'gcs-key.json',
        });
        this.ensureTempDir().catch(error => {
            logger.error('Failed to create temp directory:', error);
        });
    }
    async ensureTempDir() {
        try {
            await fs.mkdir(this.TEMP_DIR, { recursive: true });
        }
        catch (error) {
            logger.error('Failed to create temp directory:', error);
            throw new Error('Failed to create temp directory');
        }
    }
    static getInstance() {
        if (!VideoService.instance) {
            VideoService.instance = new VideoService();
        }
        return VideoService.instance;
    }
    getCollection() {
        return this.db.getCollection(this.COLLECTION);
    }
    async uploadThumbnail(thumbnailPath) {
        const filename = path.basename(thumbnailPath);
        const destination = `thumbnails/${Date.now()}_${filename}`;
        return this.storageService.uploadFile(thumbnailPath, destination, {
            public: true,
            metadata: {
                type: 'thumbnail',
            },
        });
    }
    async uploadVideo(videoBuffer, filename) {
        const destination = `videos/${Date.now()}_${filename}`;
        return this.storageService.uploadBuffer(videoBuffer, destination, {
            public: true,
            contentType: 'video/mp4',
            metadata: {
                type: 'video',
            },
        });
    }
    async uploadVideoWithMetadata(videoBuffer, filename, options) {
        try {
            // Save video buffer to temporary file
            const tempVideoPath = path.join(this.TEMP_DIR, `${Date.now()}_${filename}`);
            await fs.writeFile(tempVideoPath, videoBuffer);
            // Generate thumbnails
            const thumbnailPath = await this.thumbnailService.generateThumbnail(tempVideoPath);
            const thumbnailGridPath = await this.thumbnailService.generateThumbnailGrid(tempVideoPath, 3, 3);
            // Upload video and thumbnails
            const [videoUrl, thumbnailUrl, thumbnailGridUrl] = await Promise.all([
                this.uploadVideo(videoBuffer, filename),
                this.uploadThumbnail(thumbnailPath),
                this.uploadThumbnail(thumbnailGridPath),
            ]);
            // Get video metadata using ffprobe
            const { duration, format, resolution } = await this.thumbnailService.getVideoMetadata(tempVideoPath);
            // Cleanup temporary files
            await Promise.all([
                fs.unlink(tempVideoPath),
                this.thumbnailService.cleanup(thumbnailPath),
                this.thumbnailService.cleanup(thumbnailGridPath),
            ]);
            // Create video metadata document
            const metadata = {
                _id: new ObjectId(),
                recipeId: new ObjectId(options.recipeId),
                url: videoUrl,
                thumbnailUrl,
                thumbnailGridUrl,
                duration,
                format,
                resolution,
                timestamps: options.timestamps || [],
                chapters: [],
                annotations: [],
                subtitles: options.subtitles,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await this.getCollection().insertOne(metadata);
            return metadata;
        }
        catch (error) {
            logger.error('Failed to upload video with metadata:', error);
            throw new DatabaseError('Failed to upload video with metadata');
        }
    }
    async getVideo(videoId) {
        try {
            return await this.getCollection().findOne({ _id: new ObjectId(videoId) });
        }
        catch (error) {
            logger.error('Failed to get video:', error);
            throw new DatabaseError('Failed to get video');
        }
    }
    async getVideosByRecipe(recipeId) {
        try {
            return await this.getCollection()
                .find({ recipeId: new ObjectId(recipeId) })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get videos by recipe:', error);
            throw new DatabaseError('Failed to get videos by recipe');
        }
    }
    async updateTimestamps(videoId, timestamps) {
        try {
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $set: {
                    timestamps,
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to update timestamps:', error);
            throw new DatabaseError('Failed to update timestamps');
        }
    }
    async updateSubtitles(videoId, subtitlesUrl) {
        try {
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $set: {
                    subtitles: subtitlesUrl,
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to update subtitles:', error);
            throw new DatabaseError('Failed to update subtitles');
        }
    }
    async deleteVideo(videoId) {
        try {
            const video = await this.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }
            // Delete from Cloudflare Stream
            const streamId = video.url.split('/').pop()?.split('.')[0];
            if (streamId) {
                await fetch(`https://api.cloudflare.com/client/v4/stream/${streamId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_TOKEN}`,
                    },
                });
            }
            // Delete metadata
            await this.getCollection().deleteOne({ _id: new ObjectId(videoId) });
        }
        catch (error) {
            logger.error('Failed to delete video:', error);
            throw new DatabaseError('Failed to delete video');
        }
    }
    async addChapter(videoId, chapter) {
        try {
            const video = await this.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }
            // Generate thumbnail at chapter start time
            const tempFilePath = path.join(this.TEMP_DIR, `${Date.now()}_chapter.mp4`);
            await this.downloadVideoSegment(video.url, chapter.startTime, tempFilePath);
            const thumbnailPath = await this.thumbnailService.generateThumbnail(tempFilePath);
            const thumbnailUrl = await this.uploadThumbnail(thumbnailPath);
            // Cleanup temporary files
            await Promise.all([
                fs.unlink(tempFilePath),
                this.thumbnailService.cleanup(thumbnailPath),
            ]);
            const newChapter = {
                id: new ObjectId().toString(),
                ...chapter,
                thumbnailUrl,
            };
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $push: { chapters: newChapter },
                $set: { updatedAt: new Date() },
            });
            return newChapter;
        }
        catch (error) {
            logger.error('Failed to add chapter:', error);
            throw new DatabaseError('Failed to add chapter');
        }
    }
    async updateChapter(videoId, chapterId, updates) {
        try {
            const updateData = {};
            Object.entries(updates).forEach(([key, value]) => {
                updateData[`chapters.$.${key}`] = value;
            });
            await this.getCollection().updateOne({
                _id: new ObjectId(videoId),
                'chapters.id': chapterId,
            }, {
                $set: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to update chapter:', error);
            throw new DatabaseError('Failed to update chapter');
        }
    }
    async deleteChapter(videoId, chapterId) {
        try {
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $pull: { chapters: { id: chapterId } },
                $set: { updatedAt: new Date() },
            });
        }
        catch (error) {
            logger.error('Failed to delete chapter:', error);
            throw new DatabaseError('Failed to delete chapter');
        }
    }
    async addAnnotation(videoId, annotation) {
        try {
            const newAnnotation = {
                id: new ObjectId().toString(),
                ...annotation,
            };
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $push: { annotations: newAnnotation },
                $set: { updatedAt: new Date() },
            });
            return newAnnotation;
        }
        catch (error) {
            logger.error('Failed to add annotation:', error);
            throw new DatabaseError('Failed to add annotation');
        }
    }
    async updateAnnotation(videoId, annotationId, updates) {
        try {
            const updateData = {};
            Object.entries(updates).forEach(([key, value]) => {
                updateData[`annotations.$.${key}`] = value;
            });
            await this.getCollection().updateOne({
                _id: new ObjectId(videoId),
                'annotations.id': annotationId,
            }, {
                $set: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to update annotation:', error);
            throw new DatabaseError('Failed to update annotation');
        }
    }
    async deleteAnnotation(videoId, annotationId) {
        try {
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $pull: { annotations: { id: annotationId } },
                $set: { updatedAt: new Date() },
            });
        }
        catch (error) {
            logger.error('Failed to delete annotation:', error);
            throw new DatabaseError('Failed to delete annotation');
        }
    }
    async downloadVideoSegment(videoUrl, startTime, outputPath) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-ss', startTime.toString(),
                '-i', videoUrl,
                '-t', '1',
                '-c', 'copy',
                outputPath,
            ]);
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }
    async uploadSubtitles(videoId, subtitlesContent, extension) {
        try {
            const video = await this.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }
            // Convert to VTT format if needed
            let vttContent = subtitlesContent;
            if (extension === '.srt') {
                vttContent = await this.convertSrtToVtt(subtitlesContent);
            }
            // Upload to storage
            const destination = `subtitles/${Date.now()}_${videoId}.vtt`;
            const subtitlesUrl = await this.storageService.uploadBuffer(Buffer.from(vttContent), destination, {
                public: true,
                contentType: 'text/vtt',
                metadata: {
                    type: 'subtitles',
                    videoId,
                },
            });
            // Update video metadata
            await this.getCollection().updateOne({ _id: new ObjectId(videoId) }, {
                $set: {
                    subtitles: subtitlesUrl,
                    updatedAt: new Date(),
                },
            });
            return subtitlesUrl;
        }
        catch (error) {
            logger.error('Failed to upload subtitles:', error);
            throw new DatabaseError('Failed to upload subtitles');
        }
    }
    async convertSrtToVtt(srtContent) {
        // Basic SRT to VTT conversion
        const vttLines = ['WEBVTT\n'];
        const lines = srtContent.split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            // Skip empty lines and subtitle numbers
            if (!line || !isNaN(parseInt(line))) {
                i++;
                continue;
            }
            // Convert timestamp format from SRT (00:00:00,000) to VTT (00:00:00.000)
            if (line.includes('-->')) {
                const timestamps = line.split('-->').map(ts => ts.trim().replace(',', '.'));
                vttLines.push(timestamps.join(' --> '));
            }
            else {
                vttLines.push(line);
            }
            i++;
        }
        return vttLines.join('\n');
    }
    async getVideoMetadata(videoId) {
        try {
            const video = await this.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }
            return {
                duration: video.duration,
                format: video.format,
                resolution: video.resolution,
                thumbnails: {
                    default: video.thumbnailUrl,
                    grid: video.thumbnailGridUrl,
                },
                subtitles: video.subtitles,
                timestamps: video.timestamps,
                chapters: video.chapters,
                annotations: video.annotations,
            };
        }
        catch (error) {
            logger.error('Failed to get video metadata:', error);
            throw new DatabaseError('Failed to get video metadata');
        }
    }
}
VideoService.instance = null;
//# sourceMappingURL=video.service.js.map
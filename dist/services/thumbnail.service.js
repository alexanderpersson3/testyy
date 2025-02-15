import * as fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import logger from '../utils/logger.js';
export class ThumbnailService {
    constructor() {
        this.THUMBNAILS_DIR = path.join(process.cwd(), 'uploads/thumbnails');
        this.ensureThumbnailsDir().catch(error => {
            logger.error('Failed to create thumbnails directory:', error);
        });
    }
    async ensureThumbnailsDir() {
        try {
            await fs.mkdir(this.THUMBNAILS_DIR, { recursive: true });
        }
        catch (error) {
            logger.error('Failed to create thumbnails directory:', error);
            throw error;
        }
    }
    static getInstance() {
        if (!ThumbnailService.instance) {
            ThumbnailService.instance = new ThumbnailService();
        }
        return ThumbnailService.instance;
    }
    async generateThumbnail(videoPath, timestamp = 0) {
        const outputPath = path.join(this.THUMBNAILS_DIR, `${Date.now()}_thumbnail.jpg`);
        return new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpeg.path, [
                '-ss', timestamp.toString(),
                '-i', videoPath,
                '-vframes', '1',
                '-vf', 'scale=480:-1',
                '-f', 'image2',
                outputPath,
            ]);
            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(outputPath);
                }
                else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
            ffmpegProcess.on('error', (err) => {
                reject(err);
            });
        });
    }
    async generateThumbnailGrid(videoPath, rows = 3, cols = 3) {
        const metadata = await this.getVideoMetadata(videoPath);
        const interval = metadata.duration / (rows * cols);
        const timestamps = Array.from({ length: rows * cols }, (_, i) => i * interval);
        // Generate individual thumbnails
        const thumbnailPaths = await Promise.all(timestamps.map(timestamp => this.generateThumbnail(videoPath, timestamp)));
        // Create grid using FFmpeg
        const outputPath = path.join(this.THUMBNAILS_DIR, `${Date.now()}_grid.jpg`);
        return new Promise((resolve, reject) => {
            const filterComplex = thumbnailPaths
                .map((_, i) => `[${i}:v]scale=320:-1[v${i}];`)
                .join('') +
                thumbnailPaths
                    .map((_, i) => `[v${i}]`)
                    .join('') +
                `xstack=inputs=${thumbnailPaths.length}:layout=${rows}x${cols}`;
            const inputArgs = thumbnailPaths.flatMap(path => ['-i', path]);
            const ffmpegProcess = spawn(ffmpeg.path, [
                ...inputArgs,
                '-filter_complex', filterComplex,
                outputPath,
            ]);
            ffmpegProcess.on('close', async (code) => {
                // Cleanup individual thumbnails
                await Promise.all(thumbnailPaths.map(path => fs.unlink(path).catch(() => { })));
                if (code === 0) {
                    resolve(outputPath);
                }
                else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
            ffmpegProcess.on('error', (err) => {
                reject(err);
            });
        });
    }
    async getVideoMetadata(videoPath) {
        return new Promise((resolve, reject) => {
            const ffprobeProcess = spawn(ffmpeg.path, [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                videoPath,
            ]);
            let output = '';
            ffprobeProcess.stdout.on('data', (data) => {
                output += data;
            });
            ffprobeProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const data = JSON.parse(output);
                        const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
                        if (!videoStream) {
                            reject(new Error('No video stream found'));
                            return;
                        }
                        const metadata = {
                            duration: parseFloat(data.format.duration),
                            format: videoStream.codec_name,
                            resolution: {
                                width: videoStream.width,
                                height: videoStream.height,
                            },
                        };
                        resolve(metadata);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse video metadata'));
                    }
                }
                else {
                    reject(new Error(`FFprobe process exited with code ${code}`));
                }
            });
            ffprobeProcess.on('error', (err) => {
                reject(err);
            });
        });
    }
    async cleanup(filePath) {
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            logger.error(`Failed to delete file ${filePath}:`, error);
            // Don't throw as this is not critical
        }
    }
}
//# sourceMappingURL=thumbnail.service.js.map
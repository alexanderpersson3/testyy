import { promises as fs } from 'fs';;
import { spawn } from 'child_process';;
import path from 'path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import logger from '../utils/logger.js';

interface VideoMetadata {
  duration: number;
  format: string;
  resolution: {
    width: number;
    height: number;
  };
}

export class ThumbnailService {
  private static instance: ThumbnailService;
  private readonly THUMBNAILS_DIR: string;

  private constructor() {
    this.THUMBNAILS_DIR = path.join(process.cwd(), 'uploads/thumbnails');
    this.ensureThumbnailsDir().catch(error => {
      logger.error('Failed to create thumbnails directory:', error);
    });
  }

  private async ensureThumbnailsDir(): Promise<void> {
    try {
      await fs.mkdir(this.THUMBNAILS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create thumbnails directory:', error);
      throw error;
    }
  }

  public static getInstance(): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService();
    }
    return ThumbnailService.instance;
  }

  public async generateThumbnail(
    videoPath: string,
    timestamp: number = 0
  ): Promise<string> {
    const outputPath = path.join(
      this.THUMBNAILS_DIR,
      `${Date.now()}_thumbnail.jpg`
    );

    return new Promise<string>((resolve: any, reject: any) => {
      const ffmpegProcess = spawn(ffmpeg.path, [
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', 'scale=480:-1',
        '-f', 'image2',
        outputPath,
      ]);

      ffmpegProcess.on('close', (code: any) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (err: any) => {
        reject(err);
      });
    });
  }

  public async generateThumbnailGrid(
    videoPath: string,
    rows: number = 3,
    cols: number = 3
  ): Promise<string> {
    const metadata = await this.getVideoMetadata(videoPath);
    const interval = metadata.duration / (rows * cols);
    const timestamps = Array.from(
      { length: rows * cols },
      (_: any, i: any) => i * interval
    );

    // Generate individual thumbnails
    const thumbnailPaths = await Promise.all(
      timestamps.map(timestamp => this.generateThumbnail(videoPath, timestamp))
    );

    // Create grid using FFmpeg
    const outputPath = path.join(
      this.THUMBNAILS_DIR,
      `${Date.now()}_grid.jpg`
    );

    return new Promise<string>((resolve: any, reject: any) => {
      const filterComplex = thumbnailPaths
        .map((_: any, i: any) => `[${i}:v]scale=320:-1[v${i}];`)
        .join('') +
        thumbnailPaths
          .map((_: any, i: any) => `[v${i}]`)
          .join('') +
        `xstack=inputs=${thumbnailPaths.length}:layout=${rows}x${cols}`;

      const inputArgs = thumbnailPaths.flatMap(path => ['-i', path]);

      const ffmpegProcess = spawn(ffmpeg.path, [
        ...inputArgs,
        '-filter_complex', filterComplex,
        outputPath,
      ]);

      ffmpegProcess.on('close', async (code: any) => {
        // Cleanup individual thumbnails
        await Promise.all(
          thumbnailPaths.map(path => fs.unlink(path).catch(() => {}))
        );

        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (err: any) => {
        reject(err);
      });
    });
  }

  public async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise<VideoMetadata>((resolve: any, reject: any) => {
      const ffprobeProcess = spawn(ffmpeg.path, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ]);

      let output = '';

      ffprobeProcess.stdout.on('data', (data: any) => {
        output += data;
      });

      ffprobeProcess.on('close', (code: any) => {
        if (code === 0) {
          try {
            const data = JSON.parse(output);
            const videoStream = data.streams.find(
              (stream: any) => stream.codec_type === 'video'
            );

            if (!videoStream) {
              reject(new Error('No video stream found'));
              return;
            }

            const metadata: VideoMetadata = {
              duration: parseFloat(data.format.duration),
              format: videoStream.codec_name,
              resolution: {
                width: videoStream.width,
                height: videoStream.height,
              },
            };

            resolve(metadata);
          } catch (error) {
            reject(new Error('Failed to parse video metadata'));
          }
        } else {
          reject(new Error(`FFprobe process exited with code ${code}`));
        }
      });

      ffprobeProcess.on('error', (err: any) => {
        reject(err);
      });
    });
  }

  public async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}:`, error);
      // Don't throw as this is not critical
    }
  }
} 
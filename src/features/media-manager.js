const AWS = require('aws-sdk');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');
const { Readable } = require('stream');

class MediaManager {
  constructor() {
    // Initialize AWS S3 client
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    // CloudFront configuration
    this.cloudFront = new AWS.CloudFront({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    this.bucketName = process.env.AWS_S3_BUCKET;
    this.cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    // Supported image formats
    this.supportedImageFormats = ['image/jpeg', 'image/png', 'image/webp'];

    // Supported video formats
    this.supportedVideoFormats = ['video/mp4', 'video/webm'];

    // Thumbnail sizes
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 },
    };

    // Video quality presets
    this.videoPresets = {
      '480p': {
        resolution: '854x480',
        bitrate: '1000k',
        audioBitrate: '128k',
      },
      '720p': {
        resolution: '1280x720',
        bitrate: '2500k',
        audioBitrate: '192k',
      },
      '1080p': {
        resolution: '1920x1080',
        bitrate: '5000k',
        audioBitrate: '192k',
      },
    };
  }

  async uploadImage(file, userId, metadata = {}) {
    const cleanup = [];
    try {
      if (!this.supportedImageFormats.includes(file.mimetype)) {
        throw new Error('Unsupported image format');
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const key = `images/${userId}/${filename}`;

      // Process image with sharp for optimization
      // Use pipeline to avoid memory leaks
      const transformer = sharp()
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 });

      const processedImagePromise = new Promise((resolve, reject) => {
        const chunks = [];
        transformer.on('data', chunk => chunks.push(chunk));
        transformer.on('end', () => resolve(Buffer.concat(chunks)));
        transformer.on('error', reject);
      });

      // Stream the file buffer through sharp
      transformer.end(file.buffer);

      const optimizedBuffer = await processedImagePromise;
      cleanup.push(optimizedBuffer);

      // Upload to S3 using streams to minimize memory usage
      await this.s3
        .upload({
          Bucket: this.bucketName,
          Key: key,
          Body: optimizedBuffer,
          ContentType: 'image/jpeg',
          Metadata: {
            userId,
            originalName: file.originalname,
            ...metadata,
          },
        })
        .promise();

      // Generate and upload thumbnails using streams
      const thumbnails = await this.generateThumbnails(file.buffer, userId, filename);

      // Store media record in database
      const db = getDb();
      const mediaRecord = {
        userId: new ObjectId(userId),
        type: 'image',
        originalKey: key,
        thumbnails,
        metadata,
        createdAt: new Date(),
        status: 'active',
        size: optimizedBuffer.length,
        format: 'jpeg',
      };

      await db.collection('media').insertOne(mediaRecord);

      // Log the upload with proper error context
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.UPLOAD,
        {
          key,
          type: 'image',
          thumbnails,
          size: optimizedBuffer.length,
          format: 'jpeg',
        },
        {
          userId,
          severity: auditLogger.severityLevels.INFO,
          metadata: {
            originalName: file.originalname,
            mimeType: file.mimetype,
          },
        }
      );

      return {
        id: mediaRecord._id,
        urls: {
          original: `https://${this.cdnDomain}/${key}`,
          thumbnails: Object.fromEntries(
            Object.entries(thumbnails).map(([size, thumbKey]) => [
              size,
              `https://${this.cdnDomain}/${thumbKey}`,
            ])
          ),
        },
        metadata: {
          size: optimizedBuffer.length,
          format: 'jpeg',
          width: 2000, // Max width after resize
          height: 2000, // Max height after resize
        },
      };
    } catch (err) {
      console.error('Error uploading image:', {
        error: err,
        userId,
        fileName: file.originalname,
        fileSize: file.size,
      });

      // Attempt cleanup of any temporary resources
      cleanup.forEach(buffer => {
        try {
          if (buffer && buffer.length > 0) {
            buffer.fill(0); // Clear sensitive data
          }
        } catch (cleanupErr) {
          console.error('Error during cleanup:', cleanupErr);
        }
      });

      throw err;
    } finally {
      // Ensure buffers are cleared
      cleanup.forEach(buffer => {
        try {
          if (buffer && buffer.length > 0) {
            buffer.fill(0);
          }
        } catch (cleanupErr) {
          console.error('Error during final cleanup:', cleanupErr);
        }
      });
    }
  }

  async generateThumbnails(buffer, userId, filename) {
    const thumbnails = {};

    for (const [size, dimensions] of Object.entries(this.thumbnailSizes)) {
      const thumbBuffer = await sharp(buffer)
        .resize(dimensions.width, dimensions.height, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const key = `images/${userId}/thumbnails/${size}/${filename}`;

      await this.s3
        .putObject({
          Bucket: this.bucketName,
          Key: key,
          Body: thumbBuffer,
          ContentType: 'image/jpeg',
        })
        .promise();

      thumbnails[size] = key;
    }

    return thumbnails;
  }

  async deleteMedia(mediaId, userId) {
    try {
      const db = getDb();
      const media = await db.collection('media').findOne({
        _id: new ObjectId(mediaId),
        userId: new ObjectId(userId),
      });

      if (!media) {
        throw new Error('Media not found or unauthorized');
      }

      // Delete original from S3
      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: media.originalKey,
        })
        .promise();

      // Delete thumbnails if they exist
      if (media.thumbnails) {
        await Promise.all(
          Object.values(media.thumbnails).map(key =>
            this.s3
              .deleteObject({
                Bucket: this.bucketName,
                Key: key,
              })
              .promise()
          )
        );
      }

      // Delete from database
      await db.collection('media').deleteOne({
        _id: new ObjectId(mediaId),
      });

      // Log the deletion
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.DELETE,
        { mediaId },
        { userId, severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error deleting media:', err);
      throw err;
    }
  }

  async getMediaUrl(key) {
    return `https://${this.cdnDomain}/${key}`;
  }

  async getMediaInfo(mediaId) {
    try {
      const db = getDb();
      const media = await db.collection('media').findOne({
        _id: new ObjectId(mediaId),
      });

      if (!media) {
        throw new Error('Media not found');
      }

      return {
        ...media,
        urls: {
          original: await this.getMediaUrl(media.originalKey),
          thumbnails: media.thumbnails
            ? Object.fromEntries(
                Object.entries(media.thumbnails).map(([size, key]) => [size, this.getMediaUrl(key)])
              )
            : {},
        },
      };
    } catch (err) {
      console.error('Error getting media info:', err);
      throw err;
    }
  }

  async uploadVideo(file, userId, metadata = {}) {
    const cleanup = [];
    try {
      if (!this.supportedVideoFormats.includes(file.mimetype)) {
        throw new Error('Unsupported video format');
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const key = `videos/${userId}/${filename}`;

      // Create a read stream from the buffer
      const readStream = new Readable();
      readStream.push(file.buffer);
      readStream.push(null);
      cleanup.push(readStream);

      // Upload to S3 using streams
      await this.s3
        .upload({
          Bucket: this.bucketName,
          Key: key,
          Body: readStream,
          ContentType: file.mimetype,
          Metadata: {
            userId,
            originalName: file.originalname,
            ...metadata,
          },
        })
        .promise();

      // Store initial media record with more metadata
      const db = getDb();
      const mediaRecord = {
        userId: new ObjectId(userId),
        type: 'video',
        originalKey: key,
        status: 'processing',
        metadata: {
          ...metadata,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        createdAt: new Date(),
        processingStartedAt: new Date(),
      };

      const result = await db.collection('media').insertOne(mediaRecord);

      // Log the upload start with better context
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.UPLOAD,
        {
          key,
          type: 'video',
          size: file.size,
          status: 'processing',
        },
        {
          userId,
          severity: auditLogger.severityLevels.INFO,
          metadata: {
            originalName: file.originalname,
            mimeType: file.mimetype,
          },
        }
      );

      // Start video processing with better error handling
      this.processVideo(result.insertedId, file.buffer, userId, filename).catch(async err => {
        console.error('Error processing video:', {
          error: err,
          mediaId: result.insertedId,
          userId,
          fileName: file.originalname,
        });

        await this.updateVideoStatus(result.insertedId, 'failed', {
          error: err.message,
          failedAt: new Date(),
          processingDuration: Date.now() - mediaRecord.processingStartedAt.getTime(),
        });

        // Log processing failure
        await auditLogger.log(
          auditLogger.eventTypes.MEDIA.PROCESSING_FAILED,
          {
            mediaId: result.insertedId,
            error: err.message,
          },
          {
            userId,
            severity: auditLogger.severityLevels.ERROR,
          }
        );
      });

      return {
        id: result.insertedId,
        status: 'processing',
        urls: {
          original: `https://${this.cdnDomain}/${key}`,
        },
        metadata: {
          size: file.size,
          format: file.mimetype.split('/')[1],
          originalName: file.originalname,
        },
      };
    } catch (err) {
      console.error('Error uploading video:', {
        error: err,
        userId,
        fileName: file.originalname,
        fileSize: file.size,
      });

      // Cleanup resources
      cleanup.forEach(stream => {
        try {
          if (stream && typeof stream.destroy === 'function') {
            stream.destroy();
          }
        } catch (cleanupErr) {
          console.error('Error during cleanup:', cleanupErr);
        }
      });

      throw err;
    }
  }

  async processVideo(mediaId, buffer, userId, filename) {
    try {
      const variants = {};
      const thumbnails = {};

      // Generate video variants
      for (const [quality, preset] of Object.entries(this.videoPresets)) {
        const outputKey = `videos/${userId}/variants/${quality}/${filename}`;
        const outputBuffer = await this.transcodeVideo(buffer, preset);

        await this.s3
          .putObject({
            Bucket: this.bucketName,
            Key: outputKey,
            Body: outputBuffer,
            ContentType: 'video/mp4',
          })
          .promise();

        variants[quality] = outputKey;
      }

      // Generate video thumbnail
      const thumbnailBuffer = await this.generateVideoThumbnail(buffer);
      const thumbnailKey = `videos/${userId}/thumbnails/${filename}.jpg`;

      await this.s3
        .putObject({
          Bucket: this.bucketName,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        })
        .promise();

      thumbnails.poster = thumbnailKey;

      // Update media record with variants and thumbnail
      await this.updateVideoStatus(mediaId, 'ready', { variants, thumbnails });

      // Log successful processing
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.VIDEO_PROCESS,
        { mediaId, variants },
        { userId, severity: auditLogger.severityLevels.INFO }
      );
    } catch (err) {
      console.error('Error processing video:', err);
      throw err;
    }
  }

  async transcodeVideo(buffer, preset) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      ffmpeg()
        .input(buffer)
        .outputOptions([
          `-s ${preset.resolution}`,
          `-b:v ${preset.bitrate}`,
          `-b:a ${preset.audioBitrate}`,
          '-movflags frag_keyframe+empty_moov',
          '-f mp4',
        ])
        .toFormat('mp4')
        .on('error', reject)
        .on('data', chunk => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .run();
    });
  }

  async generateVideoThumbnail(buffer) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(buffer)
        .screenshots({
          timestamps: ['50%'],
          filename: 'thumbnail.jpg',
          size: '1280x720',
        })
        .on('error', reject)
        .on('end', resolve);
    });
  }

  async updateVideoStatus(mediaId, status, data = {}) {
    const db = getDb();
    await db.collection('media').updateOne(
      { _id: new ObjectId(mediaId) },
      {
        $set: {
          status,
          ...data,
          updatedAt: new Date(),
        },
      }
    );
  }

  async getMediaInfo(mediaId) {
    try {
      const db = getDb();
      const media = await db.collection('media').findOne({
        _id: new ObjectId(mediaId),
      });

      if (!media) {
        throw new Error('Media not found');
      }

      const urls = {
        original: await this.getMediaUrl(media.originalKey),
      };

      if (media.type === 'image' && media.thumbnails) {
        urls.thumbnails = Object.fromEntries(
          Object.entries(media.thumbnails).map(([size, key]) => [size, this.getMediaUrl(key)])
        );
      } else if (media.type === 'video') {
        if (media.variants) {
          urls.variants = Object.fromEntries(
            Object.entries(media.variants).map(([quality, key]) => [quality, this.getMediaUrl(key)])
          );
        }
        if (media.thumbnails?.poster) {
          urls.poster = this.getMediaUrl(media.thumbnails.poster);
        }
      }

      return {
        ...media,
        urls,
      };
    } catch (err) {
      console.error('Error getting media info:', err);
      throw err;
    }
  }
}

module.exports = new MediaManager();

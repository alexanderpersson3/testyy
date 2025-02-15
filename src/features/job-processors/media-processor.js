const mediaManager = require('../media-manager');
const jobQueue = require('../job-queue');
const auditLogger = require('../audit-logger');

class MediaProcessor {
  constructor() {
    // Initialize processor
    jobQueue.processQueue('media', this.processJob.bind(this));
  }

  /**
   * Process media job
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      switch (type) {
        case 'video-transcode':
          return await this.processVideoTranscode(data);
        case 'image-optimize':
          return await this.processImageOptimize(data);
        case 'thumbnail-generate':
          return await this.processThumbnailGenerate(data);
        default:
          throw new Error(`Unknown media job type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing media job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process video transcoding
   */
  async processVideoTranscode(data) {
    const { mediaId, buffer, userId, filename, preset } = data;

    try {
      // Transcode video
      const outputBuffer = await mediaManager.transcodeVideo(buffer, preset);

      // Upload transcoded video
      const outputKey = `videos/${userId}/variants/${preset.quality}/${filename}`;
      await mediaManager.s3
        .putObject({
          Bucket: mediaManager.bucketName,
          Key: outputKey,
          Body: outputBuffer,
          ContentType: 'video/mp4',
        })
        .promise();

      // Log success
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.VIDEO_TRANSCODE,
        {
          mediaId,
          preset: preset.quality,
          outputKey,
        },
        {
          userId,
          severity: auditLogger.severityLevels.INFO,
        }
      );

      return {
        key: outputKey,
        size: outputBuffer.length,
        quality: preset.quality,
      };
    } catch (error) {
      console.error('Error transcoding video:', error);
      throw error;
    }
  }

  /**
   * Process image optimization
   */
  async processImageOptimize(data) {
    const { mediaId, buffer, userId, filename, options } = data;

    try {
      // Optimize image
      const optimizedBuffer = await mediaManager.optimizeImage(buffer, options);

      // Upload optimized image
      const outputKey = `images/${userId}/optimized/${filename}`;
      await mediaManager.s3
        .putObject({
          Bucket: mediaManager.bucketName,
          Key: outputKey,
          Body: optimizedBuffer,
          ContentType: 'image/jpeg',
        })
        .promise();

      // Log success
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.IMAGE_OPTIMIZE,
        {
          mediaId,
          outputKey,
          originalSize: buffer.length,
          optimizedSize: optimizedBuffer.length,
        },
        {
          userId,
          severity: auditLogger.severityLevels.INFO,
        }
      );

      return {
        key: outputKey,
        size: optimizedBuffer.length,
        compressionRatio: buffer.length / optimizedBuffer.length,
      };
    } catch (error) {
      console.error('Error optimizing image:', error);
      throw error;
    }
  }

  /**
   * Process thumbnail generation
   */
  async processThumbnailGenerate(data) {
    const { mediaId, buffer, userId, filename, sizes } = data;

    try {
      const thumbnails = {};

      // Generate thumbnails for each size
      for (const [size, dimensions] of Object.entries(sizes)) {
        const thumbBuffer = await mediaManager.generateThumbnail(
          buffer,
          dimensions.width,
          dimensions.height
        );

        const outputKey = `images/${userId}/thumbnails/${size}/${filename}`;
        await mediaManager.s3
          .putObject({
            Bucket: mediaManager.bucketName,
            Key: outputKey,
            Body: thumbBuffer,
            ContentType: 'image/jpeg',
          })
          .promise();

        thumbnails[size] = {
          key: outputKey,
          width: dimensions.width,
          height: dimensions.height,
          size: thumbBuffer.length,
        };
      }

      // Log success
      await auditLogger.log(
        auditLogger.eventTypes.MEDIA.THUMBNAIL_GENERATE,
        {
          mediaId,
          thumbnails,
        },
        {
          userId,
          severity: auditLogger.severityLevels.INFO,
        }
      );

      return { thumbnails };
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new MediaProcessor();

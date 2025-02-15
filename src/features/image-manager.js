import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import AWS from 'aws-sdk';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

class ImageManager {
  constructor() {
    // Initialize AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.bucketName = process.env.AWS_S3_BUCKET;

    // Image variants configuration
    this.imageVariants = {
      original: { width: null, height: null },
      large: { width: 1200, height: 800 },
      medium: { width: 600, height: 400 },
      thumbnail: { width: 300, height: 200 },
    };
  }

  /**
   * Upload recipe images
   * @param {string} recipeId Recipe ID
   * @param {Array<Buffer>} images Array of image buffers
   * @returns {Promise<Array>} Uploaded image details
   */
  async uploadRecipeImages(recipeId, images) {
    try {
      const db = getDb();
      const uploadedImages = [];

      for (const imageBuffer of images) {
        // Generate unique ID for the image
        const imageId = uuidv4();
        const variants = {};

        // Process and upload each variant
        for (const [variantName, dimensions] of Object.entries(this.imageVariants)) {
          let processedImage = sharp(imageBuffer);

          // Resize if dimensions are specified
          if (dimensions.width && dimensions.height) {
            processedImage = processedImage.resize(dimensions.width, dimensions.height, {
              fit: 'cover',
              position: 'center',
            });
          }

          // Convert to different formats
          const formats = ['jpeg', 'webp'];
          variants[variantName] = {};

          for (const format of formats) {
            const buffer = await processedImage[format]({ quality: 80 }).toBuffer();
            const key = `recipes/${recipeId}/${imageId}/${variantName}.${format}`;

            // Upload to S3
            await this.s3
              .putObject({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: `image/${format}`,
                ACL: 'public-read',
              })
              .promise();

            variants[variantName][format] = {
              url: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
              width: dimensions.width,
              height: dimensions.height,
            };
          }
        }

        // Save image metadata to database
        const imageDoc = {
          recipeId: new ObjectId(recipeId),
          imageId,
          variants,
          createdAt: new Date(),
        };

        await db.collection('images').insertOne(imageDoc);
        uploadedImages.push(imageDoc);
      }

      // Update recipe with new images
      await db.collection('recipes').updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $push: {
            images: {
              $each: uploadedImages.map(img => ({
                imageId: img.imageId,
                variants: img.variants,
              })),
            },
          },
        }
      );

      return uploadedImages;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    }
  }

  /**
   * Delete recipe images
   * @param {string} recipeId Recipe ID
   * @param {Array<string>} imageIds Array of image IDs to delete
   */
  async deleteRecipeImages(recipeId, imageIds) {
    try {
      const db = getDb();

      // Get image details
      const images = await db
        .collection('images')
        .find({
          recipeId: new ObjectId(recipeId),
          imageId: { $in: imageIds },
        })
        .toArray();

      // Delete from S3
      for (const image of images) {
        for (const [variantName, variants] of Object.entries(image.variants)) {
          for (const format of Object.keys(variants)) {
            const key = `recipes/${recipeId}/${image.imageId}/${variantName}.${format}`;
            await this.s3
              .deleteObject({
                Bucket: this.bucketName,
                Key: key,
              })
              .promise();
          }
        }
      }

      // Delete from database
      await db.collection('images').deleteMany({
        recipeId: new ObjectId(recipeId),
        imageId: { $in: imageIds },
      });

      // Update recipe
      await db.collection('recipes').updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $pull: {
            images: {
              imageId: { $in: imageIds },
            },
          },
        }
      );
    } catch (error) {
      console.error('Error deleting images:', error);
      throw error;
    }
  }

  /**
   * Upload user profile image
   * @param {string} userId User ID
   * @param {Buffer} imageBuffer Image buffer
   * @returns {Promise<Object>} Uploaded image details
   */
  async uploadProfileImage(userId, imageBuffer) {
    try {
      const db = getDb();
      const imageId = uuidv4();
      const variants = {};

      // Process and upload profile image variants
      for (const [variantName, dimensions] of Object.entries({
        large: { width: 400, height: 400 },
        small: { width: 100, height: 100 },
      })) {
        let processedImage = sharp(imageBuffer).resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: 'center',
        });

        variants[variantName] = {};
        const formats = ['jpeg', 'webp'];

        for (const format of formats) {
          const buffer = await processedImage[format]({ quality: 80 }).toBuffer();
          const key = `profiles/${userId}/${imageId}/${variantName}.${format}`;

          await this.s3
            .putObject({
              Bucket: this.bucketName,
              Key: key,
              Body: buffer,
              ContentType: `image/${format}`,
              ACL: 'public-read',
            })
            .promise();

          variants[variantName][format] = {
            url: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
            width: dimensions.width,
            height: dimensions.height,
          };
        }
      }

      // Update user profile
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            profileImage: {
              imageId,
              variants,
            },
          },
        }
      );

      return { imageId, variants };
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  }
}

export default new ImageManager();

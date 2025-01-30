import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const router = Router();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
      return;
    }
    cb(null, true);
  }
});

// Image processing configurations
const imageConfigs = {
  recipe: {
    main: { width: 1200, height: 800, quality: 80 },
    thumbnail: { width: 300, height: 200, quality: 60 }
  },
  profile: {
    main: { width: 400, height: 400, quality: 80 },
    thumbnail: { width: 100, height: 100, quality: 60 }
  },
  challenge: {
    main: { width: 1200, height: 800, quality: 80 },
    thumbnail: { width: 300, height: 200, quality: 60 }
  }
};

// Validation schemas
const uploadSchema = z.object({
  type: z.enum(['recipe', 'profile', 'challenge']),
  entityId: z.string().optional(),
  position: z.number().int().optional()
});

// Helper function to process and upload image
async function processAndUploadImage(buffer, type, filename, config) {
  const processedImages = {};
  
  for (const [size, dimensions] of Object.entries(config)) {
    const processed = await sharp(buffer)
      .resize(dimensions.width, dimensions.height, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: dimensions.quality })
      .toBuffer();

    const key = `${type}/${size}/${filename}.webp`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: processed,
      ContentType: 'image/webp'
    }));

    processedImages[size] = `${process.env.CDN_URL}/${key}`;
  }

  return processedImages;
}

// Upload image
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { type, entityId, position } = uploadSchema.parse(req.body);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const filename = uuidv4();
    const config = imageConfigs[type];
    const urls = await processAndUploadImage(req.file.buffer, type, filename, config);

    const db = getDb();
    const imageDoc = {
      userId: new ObjectId(req.user.id),
      type,
      filename,
      urls,
      originalName: req.file.originalname,
      size: req.file.size,
      createdAt: new Date()
    };

    if (entityId) {
      imageDoc.entityId = new ObjectId(entityId);
    }

    if (position !== undefined) {
      imageDoc.position = position;
    }

    const result = await db.collection('images').insertOne(imageDoc);

    // Update related entity with the new image
    if (entityId) {
      switch (type) {
        case 'recipe':
          await db.collection('recipes').updateOne(
            { _id: new ObjectId(entityId) },
            { $push: { images: result.insertedId } }
          );
          break;
        case 'profile':
          await db.collection('users').updateOne(
            { _id: new ObjectId(entityId) },
            { $set: { avatar: urls.main } }
          );
          break;
        case 'challenge':
          await db.collection('challenge_submissions').updateOne(
            { _id: new ObjectId(entityId) },
            { $push: { images: result.insertedId } }
          );
          break;
      }
    }

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        _id: result.insertedId,
        ...imageDoc
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete image
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const imageId = new ObjectId(req.params.id);
    
    const image = await db.collection('images').findOne({
      _id: imageId,
      userId: new ObjectId(req.user.id)
    });

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete from S3
    for (const [size, url] of Object.entries(image.urls)) {
      const key = url.replace(`${process.env.CDN_URL}/`, '');
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      }));
    }

    // Remove image reference from related entity
    if (image.entityId) {
      switch (image.type) {
        case 'recipe':
          await db.collection('recipes').updateOne(
            { _id: image.entityId },
            { $pull: { images: imageId } }
          );
          break;
        case 'profile':
          await db.collection('users').updateOne(
            { _id: image.entityId },
            { $unset: { avatar: "" } }
          );
          break;
        case 'challenge':
          await db.collection('challenge_submissions').updateOne(
            { _id: image.entityId },
            { $pull: { images: imageId } }
          );
          break;
      }
    }

    // Delete image document
    await db.collection('images').deleteOne({ _id: imageId });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

// Get images by entity
router.get('/entity/:type/:entityId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { type } = uploadSchema.parse({ type: req.params.type });
    const entityId = new ObjectId(req.params.entityId);

    const images = await db.collection('images')
      .find({ type, entityId })
      .sort({ position: 1, createdAt: -1 })
      .toArray();

    res.json(images);
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ message: 'Failed to get images' });
  }
});

// Update image metadata
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const imageId = new ObjectId(req.params.id);
    const { position } = z.object({
      position: z.number().int()
    }).parse(req.body);

    const result = await db.collection('images').findOneAndUpdate(
      { _id: imageId, userId: new ObjectId(req.user.id) },
      { $set: { position, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json(result.value);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Failed to update image' });
  }
});

// Admin: Clean up orphaned images
router.post('/cleanup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const orphanedImages = await db.collection('images')
      .find({
        entityId: { $exists: false },
        createdAt: { $lt: cutoffDate }
      })
      .toArray();

    for (const image of orphanedImages) {
      // Delete from S3
      for (const [size, url] of Object.entries(image.urls)) {
        const key = url.replace(`${process.env.CDN_URL}/`, '');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: key
        }));
      }
    }

    // Delete image documents
    const result = await db.collection('images').deleteMany({
      entityId: { $exists: false },
      createdAt: { $lt: cutoffDate }
    });

    res.json({
      message: 'Cleanup completed successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ message: 'Failed to clean up images' });
  }
});

export default router; 
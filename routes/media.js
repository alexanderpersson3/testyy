const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const mediaManager = require('../services/media-manager');
const { body, param, query } = require('express-validator');
const { validateRequest } = require('../middleware/validate-request');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 1
  }
});

// Validation middleware
const validateUpload = [
  body('type')
    .optional()
    .isIn(['recipe', 'profile', 'ingredient'])
    .withMessage('Invalid media type'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

// Upload media
router.post(
  '/upload',
  auth,
  upload.single('file'),
  validateUpload,
  validateRequest,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      let result;
      if (req.file.mimetype.startsWith('video/')) {
        result = await mediaManager.uploadVideo(
          req.file,
          req.user.id,
          req.body.metadata || {}
        );
      } else if (req.file.mimetype.startsWith('image/')) {
        result = await mediaManager.uploadImage(
          req.file,
          req.user.id,
          req.body.metadata || {}
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported file type'
        });
      }

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('Error uploading media:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Error uploading media'
      });
    }
  }
);

// Get media info
router.get(
  '/:mediaId',
  param('mediaId').isMongoId().withMessage('Invalid media ID'),
  validateRequest,
  async (req, res) => {
    try {
      const media = await mediaManager.getMediaInfo(req.params.mediaId);
      res.json({
        success: true,
        data: media
      });
    } catch (err) {
      if (err.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error retrieving media'
      });
    }
  }
);

// Get video processing status
router.get(
  '/:mediaId/status',
  auth,
  param('mediaId').isMongoId().withMessage('Invalid media ID'),
  validateRequest,
  async (req, res) => {
    try {
      const media = await mediaManager.getMediaInfo(req.params.mediaId);
      
      if (media.type !== 'video') {
        return res.status(400).json({
          success: false,
          message: 'Not a video'
        });
      }

      res.json({
        success: true,
        data: {
          status: media.status,
          progress: media.progress,
          error: media.error
        }
      });
    } catch (err) {
      if (err.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error retrieving video status'
      });
    }
  }
);

// Delete media
router.delete(
  '/:mediaId',
  auth,
  param('mediaId').isMongoId().withMessage('Invalid media ID'),
  validateRequest,
  async (req, res) => {
    try {
      await mediaManager.deleteMedia(req.params.mediaId, req.user.id);
      res.json({
        success: true,
        message: 'Media deleted successfully'
      });
    } catch (err) {
      if (err.message === 'Media not found or unauthorized') {
        return res.status(404).json({
          success: false,
          message: err.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error deleting media'
      });
    }
  }
);

module.exports = router; 
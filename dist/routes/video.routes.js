import * as fs from 'fs';
;
import multer from 'multer';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { VideoService } from '../services/video.service.js';
import { handleError } from '../utils/errors.js';
import path from 'path';
import logger from '../utils/logger.js';
const router = Router();
const videoService = VideoService.getInstance();
// Configure multer for video uploads
const upload = multer({
    dest: path.join(process.cwd(), 'uploads/temp'),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only video files are allowed'), false);
        }
    },
});
// Configure multer for subtitle uploads
const subtitleUpload = multer({
    dest: path.join(process.cwd(), 'uploads/temp'),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['text/vtt', 'application/x-subrip', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only VTT, SRT, and plain text subtitle files are allowed'), false);
        }
    },
});
// Validation schemas
const timestampSchema = z.object({
    time: z.number().min(0),
    label: z.string().min(1),
    description: z.string().optional(),
});
const uploadSchema = z.object({
    recipeId: z.string().min(1),
    timestamps: z.array(timestampSchema).optional(),
    subtitles: z.string().optional(),
});
const chapterSchema = z.object({
    title: z.string().min(1),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
});
const annotationSchema = z.object({
    time: z.number().min(0),
    text: z.string().min(1),
    position: z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
    }),
    duration: z.number().min(0).optional(),
});
// Routes
router.post('/upload', auth, upload.single('video'), validate(uploadSchema), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }
        // Read the file into a buffer
        const videoBuffer = await fs.readFile(req.file.path);
        // Upload video with metadata
        const metadata = await videoService.uploadVideoWithMetadata(videoBuffer, req.file.originalname, {
            recipeId: req.body.recipeId,
            timestamps: req.body.timestamps,
            subtitles: req.body.subtitles,
        });
        // Clean up temporary file
        await fs.unlink(req.file.path).catch(error => {
            logger.error('Failed to delete temporary file:', error);
        });
        res.status(201).json(metadata);
    }
    catch (error) {
        // Clean up temporary file in case of error
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => { });
        }
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/recipe/:recipeId', auth, async (req, res) => {
    try {
        const videos = await videoService.getVideosByRecipe(req.params.recipeId);
        res.json(videos);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/:videoId', auth, async (req, res) => {
    try {
        const video = await videoService.getVideo(req.params.videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        res.json(video);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Get video metadata
router.get('/:videoId/metadata', auth, async (req, res) => {
    try {
        const metadata = await videoService.getVideoMetadata(req.params.videoId);
        res.json(metadata);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Chapter routes
router.post('/:videoId/chapters', auth, validate(chapterSchema), async (req, res) => {
    try {
        const { videoId } = req.params;
        const chapter = await videoService.addChapter(videoId, req.body);
        res.status(201).json(chapter);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/:videoId/chapters/:chapterId', auth, async (req, res) => {
    try {
        const { videoId, chapterId } = req.params;
        const updates = await chapterSchema.partial().parseAsync(req.body);
        await videoService.updateChapter(videoId, chapterId, updates);
        res.status(200).json({ message: 'Chapter updated successfully' });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.delete('/:videoId/chapters/:chapterId', auth, async (req, res) => {
    try {
        const { videoId, chapterId } = req.params;
        await videoService.deleteChapter(videoId, chapterId);
        res.status(200).json({ message: 'Chapter deleted successfully' });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Annotation routes
router.post('/:videoId/annotations', auth, validate(annotationSchema), async (req, res) => {
    try {
        const { videoId } = req.params;
        const annotation = await videoService.addAnnotation(videoId, req.body);
        res.status(201).json(annotation);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/:videoId/annotations/:annotationId', auth, async (req, res) => {
    try {
        const { videoId, annotationId } = req.params;
        const updates = await annotationSchema.partial().parseAsync(req.body);
        await videoService.updateAnnotation(videoId, annotationId, updates);
        res.status(200).json({ message: 'Annotation updated successfully' });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.delete('/:videoId/annotations/:annotationId', auth, async (req, res) => {
    try {
        const { videoId, annotationId } = req.params;
        await videoService.deleteAnnotation(videoId, annotationId);
        res.status(200).json({ message: 'Annotation deleted successfully' });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Subtitle routes
router.post('/:videoId/subtitles', auth, subtitleUpload.single('subtitles'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No subtitles file provided' });
        }
        // Read the subtitle file
        const subtitlesContent = await fs.readFile(req.file.path, 'utf-8');
        // Upload subtitles to storage service
        const subtitlesUrl = await videoService.uploadSubtitles(req.params.videoId, subtitlesContent, path.extname(req.file.originalname).toLowerCase());
        // Clean up temporary file
        await fs.unlink(req.file.path).catch(error => {
            logger.error('Failed to delete temporary subtitle file:', error);
        });
        res.json({ subtitlesUrl });
    }
    catch (error) {
        // Clean up temporary file in case of error
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => { });
        }
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=video.routes.js.map
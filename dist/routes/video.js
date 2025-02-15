import * as fs from 'fs';
;
import multer from 'multer';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { VideoService } from '../services/video.service.js';
import { handleError } from '../utils/errors.js';
import { NotFoundError } from '../utils/errors.js';
const router = Router();
const videoService = VideoService.getInstance();
// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, 'uploads/temp');
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only MP4, WebM, and QuickTime videos are allowed'));
        }
    },
});
// Validation schemas
const timestampSchema = z.object({
    time: z.number().min(0),
    label: z.string().min(1).max(100),
    description: z.string().max(500),
});
const uploadVideoSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    timestamps: z.array(timestampSchema).optional(),
});
const updateTimestampsSchema = z.object({
    timestamps: z.array(timestampSchema),
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
router.post('/upload', auth, upload.single('video'), validate(uploadVideoSchema), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }
        // Read file into buffer
        const videoBuffer = await fs.readFile(req.file.path);
        const video = await videoService.uploadVideoWithMetadata(videoBuffer, req.file.originalname, {
            recipeId: req.body.recipeId,
            timestamps: req.body.timestamps,
        });
        // Clean up temp file
        await fs.unlink(req.file.path).catch(console.error);
        res.status(201).json(video);
    }
    catch (error) {
        // Clean up temp file on error
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/recipe/:recipeId', async (req, res, next) => {
    try {
        const videos = await videoService.getVideosByRecipe(req.params.recipeId);
        res.json(videos);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:videoId', async (req, res, next) => {
    try {
        const video = await videoService.getVideo(req.params.videoId);
        if (!video) {
            throw new NotFoundError('Video not found');
        }
        res.json(video);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:videoId/timestamps', auth, validate(updateTimestampsSchema), async (req, res, next) => {
    try {
        await videoService.updateTimestamps(req.params.videoId, req.body.timestamps);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.post('/:videoId/subtitles', auth, upload.single('subtitles'), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No subtitles file provided' });
            return;
        }
        // TODO: Implement subtitle file upload to storage service
        const subtitlesUrl = 'https://example.com/subtitles.vtt';
        await videoService.updateSubtitles(req.params.videoId, subtitlesUrl);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:videoId', auth, async (req, res, next) => {
    try {
        await videoService.deleteVideo(req.params.videoId);
        res.status(204).send();
    }
    catch (error) {
        next(error);
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
        res.status(500).json({ error: 'Failed to add chapter' });
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
        res.status(500).json({ error: 'Failed to update chapter' });
    }
});
router.delete('/:videoId/chapters/:chapterId', auth, async (req, res) => {
    try {
        const { videoId, chapterId } = req.params;
        await videoService.deleteChapter(videoId, chapterId);
        res.status(200).json({ message: 'Chapter deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete chapter' });
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
        res.status(500).json({ error: 'Failed to add annotation' });
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
        res.status(500).json({ error: 'Failed to update annotation' });
    }
});
router.delete('/:videoId/annotations/:annotationId', auth, async (req, res) => {
    try {
        const { videoId, annotationId } = req.params;
        await videoService.deleteAnnotation(videoId, annotationId);
        res.status(200).json({ message: 'Annotation deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete annotation' });
    }
});
export default router;
//# sourceMappingURL=video.js.map
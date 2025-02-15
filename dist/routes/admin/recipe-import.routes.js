;
import multer from 'multer';
import { auth } from '../../middleware/auth.js';
import { handleError } from '../../utils/errors.js';
import { ObjectId } from 'mongodb';
;
import path from 'path';
const router = Router();
const importService = RecipeImportService.getInstance();
// Configure multer for CSV uploads
const upload = multer({
    dest: path.join(process.cwd(), 'uploads/temp'),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
        if (file.mimetype === 'text/csv') {
            callback(null, true);
        }
        else {
            callback(new Error('Only CSV files are allowed'), false);
        }
    },
});
// Import recipes from CSV
router.post('/import', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        const csvContent = req.file.buffer.toString('utf-8');
        const result = await importService.importFromCSV(csvContent, new ObjectId(req.user.id));
        res.json({
            message: 'Import completed',
            total: result.total,
            imported: result.imported,
            failed: result.failed,
            errors: result.errors,
        });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Export recipes to CSV
router.get('/export', auth, async (req, res) => {
    try {
        const { status, cuisine, startDate, endDate } = req.query;
        const query = {};
        if (status) {
            query.status = status;
        }
        if (cuisine) {
            query.cuisine = cuisine;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }
        const csvContent = await importService.exportToCSV(query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=recipes.csv');
        res.send(csvContent);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=recipe-import.routes.js.map
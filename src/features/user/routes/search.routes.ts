import { Router } from 'express';;
import type { Router } from '../types/express.js';;
import { searchController } from '../controllers/search.controller.js';;
import { auth } from '../middleware/auth.js';;

const router = Router();

// Public routes
router.get('/products', searchController.search);
router.get('/suggestions', searchController.getSuggestions);

// Protected routes (require authentication)
router.post('/products', auth, searchController.indexProduct);
router.put('/products/:id', auth, searchController.updateProduct);
router.delete('/products/:id', auth, searchController.deleteProduct);
router.post('/initialize', auth, searchController.initializeIndex);

export default router;

import { Router } from 'express';;
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import { z } from 'zod';;
import { SupplierService } from '../services/supplier.service.js';;
import { auth, requireRole } from '../middleware/auth.js';;
import type { validateRequest } from '../types/express.js';
import { UserRole } from '../types/auth.js';;

const router = Router();
const supplierService = SupplierService.getInstance();

// Create supplier schema
const createSupplierSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  type: z.enum(['farmer', 'artisan', 'market', 'cooperative']),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  businessHours: z.array(
    z.object({
      day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
      open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      isClosed: z.boolean(),
    })
  ),
  contactInfo: z.object({
    phone: z.string(),
    email: z.string().email(),
    website: z.string().url().optional(),
  }),
  deliveryOptions: z.object({
    pickup: z.boolean(),
    delivery: z.boolean(),
    deliveryRadius: z.number().optional(),
    minimumOrder: z.number().optional(),
    deliveryFee: z.number().optional(),
  }),
  paymentMethods: z.array(z.enum(['cash', 'card', 'online', 'transfer'])),
  images: z
    .object({
      logo: z.string().url().optional(),
      storefront: z.array(z.string().url()).optional(),
      products: z.array(z.string().url()).optional(),
    })
    .optional(),
  socialMedia: z
    .object({
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      twitter: z.string().url().optional(),
    })
    .optional(),
});

// Create supplier
router.post('/', auth, validateRequest(createSupplierSchema), async (req: any, res: any) => {
  try {
    const supplier = await supplierService.createSupplier(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier schema
const updateSupplierSchema = createSupplierSchema.partial();

// Update supplier
router.patch(
  '/:supplierId',
  auth,
  validateRequest(updateSupplierSchema),
  async (req: any, res: any) => {
    try {
      const supplier = await supplierService.updateSupplier(
        new ObjectId(req.params.supplierId),
        req.body
      );
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  }
);

// Get supplier
router.get('/:supplierId', async (req: any, res: any) => {
  try {
    const supplier = await supplierService.getSupplier(new ObjectId(req.params.supplierId));
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get supplier' });
  }
});

// Search suppliers schema
const searchSuppliersSchema = z.object({
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number(),
    })
    .optional(),
  type: z.array(z.enum(['farmer', 'artisan', 'market', 'cooperative'])).optional(),
  products: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  deliveryOptions: z
    .object({
      pickup: z.boolean().optional(),
      delivery: z.boolean().optional(),
    })
    .optional(),
  openNow: z.boolean().optional(),
  specialDeals: z.boolean().optional(),
  sortBy: z.enum(['distance', 'rating', 'name']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// Search suppliers
router.get('/', validateRequest(searchSuppliersSchema, 'query'), async (req: any, res: any) => {
  try {
    const suppliers = await supplierService.searchSuppliers(req.query);
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search suppliers' });
  }
});

// Add product schema
const addProductSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string(),
  description: z.string().optional(),
  unit: z.string(),
  price: z.number().min(0),
  currency: z.string(),
  inStock: z.boolean(),
  quantity: z.number().optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  seasonality: z
    .object({
      startMonth: z.number().min(1).max(12),
      endMonth: z.number().min(1).max(12),
    })
    .optional(),
});

// Add product
router.post(
  '/:supplierId/products',
  auth,
  validateRequest(addProductSchema),
  async (req: any, res: any) => {
    try {
      const product = await supplierService.addProduct(
        new ObjectId(req.params.supplierId),
        req.body
      );
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add product' });
    }
  }
);

// Update product
router.patch(
  '/:supplierId/products/:productId',
  auth,
  validateRequest(addProductSchema.partial()),
  async (req: any, res: any) => {
    try {
      await supplierService.updateProduct(
        new ObjectId(req.params.supplierId),
        new ObjectId(req.params.productId),
        req.body
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

// Add special deal schema
const addSpecialDealSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string(),
  discount: z.number().min(0).max(100),
  discountType: z.enum(['percentage', 'fixed']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  products: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
  minimumPurchase: z.number().optional(),
  maximumDiscount: z.number().optional(),
  terms: z.string().optional(),
});

// Add special deal
router.post(
  '/:supplierId/deals',
  auth,
  validateRequest(addSpecialDealSchema),
  async (req: any, res: any) => {
    try {
      const deal = await supplierService.addSpecialDeal(new ObjectId(req.params.supplierId), {
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        products: req.body.products.map((id: string) => new ObjectId(id)),
      });
      res.status(201).json(deal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add special deal' });
    }
  }
);

// Add review schema
const addReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  verifiedPurchase: z.boolean(),
});

// Add review
router.post(
  '/:supplierId/reviews',
  auth,
  validateRequest(addReviewSchema),
  async (req: any, res: any) => {
    try {
      const review = await supplierService.addReview({
        supplierId: new ObjectId(req.params.supplierId),
        userId: new ObjectId(req.user!.id),
        ...req.body,
      });
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add review' });
    }
  }
);

// Get reviews schema
const getReviewsSchema = z.object({
  limit: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1).max(100))
    .optional(),
  offset: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(0))
    .optional(),
  sortBy: z.enum(['date', 'rating', 'helpful']).optional(),
});

// Get reviews
router.get('/:supplierId/reviews', validateRequest(getReviewsSchema, 'query'), async (req: any, res: any) => {
  try {
    const reviews = await supplierService.getReviews(new ObjectId(req.params.supplierId), {
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      sortBy: req.query.sortBy as 'date' | 'rating' | 'helpful' | undefined,
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// Mark review as helpful
router.post('/reviews/:reviewId/helpful', auth, async (req: any, res: any) => {
  try {
    await supplierService.markReviewHelpful(new ObjectId(req.params.reviewId));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

// Report review schema
const reportReviewSchema = z.object({
  reason: z.string().min(1),
});

// Report review
router.post(
  '/reviews/:reviewId/report',
  auth,
  validateRequest(reportReviewSchema),
  async (req: any, res: any) => {
    try {
      await supplierService.reportReview(new ObjectId(req.params.reviewId), req.body.reason);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to report review' });
    }
  }
);

// Verify supplier schema
const verifySupplierSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  document: z.string(),
  notes: z.string().optional(),
});

// Verify supplier
router.post(
  '/:supplierId/verify',
  auth,
  requireRole(UserRole.ADMIN),
  validateRequest(verifySupplierSchema),
  async (req: any, res: any) => {
    try {
      await supplierService.verifySupplier(
        new ObjectId(req.params.supplierId),
        new ObjectId(req.user!.id),
        req.body.status,
        req.body.document,
        req.body.notes
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify supplier' });
    }
  }
);

export default router;

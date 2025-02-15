;
import crudRoutes from './crud.routes.js';
import interactionRoutes from './interactions.routes.js';
import sharingRoutes from './sharing.routes.js';
const router = Router();
router.use('/', crudRoutes);
router.use('/', interactionRoutes);
router.use('/', sharingRoutes);
export default router;
//# sourceMappingURL=index.js.map
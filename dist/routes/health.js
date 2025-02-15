;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HealthIntegrationService } from '../services/health-integration.service.js';
import { DatabaseError, NotFoundError, ValidationError, AuthError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import * as Sentry from '@sentry/node';
const router = Router();
const healthService = HealthIntegrationService.getInstance();
router.post('/connect/:provider', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const provider = req.params.provider;
    const userId = req.user.id;
    const accessToken = req.body.accessToken;
    await healthService.connectProvider(userId, provider, accessToken);
    res.status(200).json({ message: 'Health provider connected successfully' });
}));
router.delete('/disconnect/:provider', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const provider = req.params.provider;
    const userId = req.user.id;
    await healthService.disconnectProvider(userId, provider);
    res.status(200).json({ message: 'Health provider disconnected successfully' });
}));
router.get('/config/healthkit', auth, asyncHandler(async (req, res) => {
    const config = healthService.getHealthKitConfig();
    res.status(200).json(config);
}));
router.get('/config/googlefit', auth, asyncHandler(async (req, res) => {
    const config = healthService.getGoogleFitConfig();
    res.status(200).json(config);
}));
router.post('/sync', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = req.user.id;
    await healthService.syncHealthData(userId);
    res.status(200).json({ message: 'Health data synced successfully' });
}));
router.get('/data', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = req.user.id;
    const data = await healthService.getHealthData(userId);
    if (!data) {
        throw new NotFoundError('Health data not found');
    }
    res.status(200).json(data);
}));
// Health check endpoints
router.get('/', asyncHandler(async (req, res) => {
    res.status(200).json({ status: 'ok' });
}));
router.get('/metrics', asyncHandler(async (req, res) => {
    const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
    };
    res.status(200).json(metrics);
}));
// Error test endpoints
router.get('/error/async', asyncHandler(async (req, res) => {
    throw new Error('Test async error');
}));
router.get('/error/custom', asyncHandler(async (req, res) => {
    throw new ValidationError('Test validation error');
}));
router.get('/error/db', asyncHandler(async (req, res) => {
    throw new DatabaseError('Test database error');
}));
router.get('/error/validation', asyncHandler(async (req, res) => {
    throw new ValidationError('Test validation error');
}));
// Test Sentry connection
router.get('/test-sentry', (req, res) => {
    console.log('Testing Sentry connection...');
    // 1. Send a test message
    console.log('Sending test message...');
    Sentry.captureMessage('Test message from health endpoint');
    // 2. Send a test error
    console.log('Sending test error...');
    try {
        throw new Error('Test error from health endpoint');
    }
    catch (e) {
        Sentry.captureException(e);
    }
    // 3. Send response
    res.json({
        success: true,
        message: 'Test events sent to Sentry',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});
export default router;
//# sourceMappingURL=health.js.map
import { Router } from 'express';;
import type { Router } from '../types/express.js';;
import { connectToDatabase } from '../db.js';;
import { CacheService } from '../services/cache.service.js';;
import logger from '../utils/logger.js';

const router = Router();
const cacheService = CacheService.getInstance();

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
    redis?: ServiceStatus;
    storage?: ServiceStatus;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Check MongoDB connection
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const startTime = Date.now();
  try {
    const db = await connectToDatabase();
    await db.command({ ping: 1 });
    return {
      status: 'up',
      latency: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check cache service
 */
async function checkCache(): Promise<ServiceStatus> {
  const startTime = Date.now();
  try {
    const isHealthy = cacheService.isHealthy();
    const size = cacheService.size();
    return {
      status: isHealthy ? 'up' : 'degraded',
      latency: Date.now() - startTime,
      details: {
        size,
        maxSize: 1000, // TODO: Get from config
      },
    };
  } catch (error) {
    logger.error('Cache health check failed:', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<ServiceStatus> {
  const startTime = Date.now();
  try {
    // TODO: Add Redis client check
    return {
      status: 'up',
      latency: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check storage service
 */
async function checkStorage(): Promise<ServiceStatus> {
  const startTime = Date.now();
  try {
    // TODO: Add storage service check
    return {
      status: 'up',
      latency: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Storage health check failed:', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get overall system status
 */
function getOverallStatus(services: HealthStatus['services']): HealthStatus['status'] {
  const statuses = Object.values(services).map(s => s.status);
  if (statuses.every(s => s === 'up')) {
    return 'healthy';
  }
  if (statuses.some(s => s === 'down')) {
    return 'unhealthy';
  }
  return 'degraded';
}

/**
 * Get memory usage
 */
function getMemoryUsage(): HealthStatus['memory'] {
  const memory = process.memoryUsage();
  return {
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
    external: Math.round(memory.external / 1024 / 1024), // MB
    rss: Math.round(memory.rss / 1024 / 1024), // MB
  };
}

// Health check endpoint
router.get('/', async (req: any, res: any) => {
  try {
    const [database, cache, redis, storage] = await Promise.all([
      checkDatabase(),
      checkCache(),
      checkRedis(),
      checkStorage(),
    ]);

    const services = { database, cache, redis, storage };
    const status = getOverallStatus(services);

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services,
      memory: getMemoryUsage(),
    };

    res.status(status === 'unhealthy' ? 503 : 200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Liveness probe endpoint
router.get('/liveness', (_req: any, res: any) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe endpoint
router.get('/readiness', async (req: any, res: any) => {
  try {
    const database = await checkDatabase();
    if (database.status === 'down') {
      res.status(503).json({ status: 'not ready', reason: 'Database unavailable' });
      return;
    }
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

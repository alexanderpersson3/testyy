import { Router } from 'express';
import { getDb } from '../db.js';
import { monitoring } from '../config/cloud.js';

const router = Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      services: {
        database: 'unknown',
        cache: 'unknown'
      }
    };

    // Check database connection
    try {
      const db = getDb();
      await db.command({ ping: 1 });
      healthStatus.services.database = 'healthy';
    } catch (error) {
      healthStatus.services.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Check Redis connection if used
    try {
      if (global.redisClient) {
        await global.redisClient.ping();
        healthStatus.services.cache = 'healthy';
      }
    } catch (error) {
      healthStatus.services.cache = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Report custom metrics to Cloud Monitoring
    try {
      const metricClient = monitoring.metricServiceClient();
      
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Date.now() / 1000
          }
        },
        value: {
          boolValue: healthStatus.status === 'healthy'
        }
      };

      const timeSeriesData = {
        metric: {
          type: 'custom.googleapis.com/rezepta/health_status',
          labels: {
            status: healthStatus.status,
            version: process.env.npm_package_version
          }
        },
        resource: {
          type: 'cloud_run_revision',
          labels: {
            service_name: 'rezepta-backend',
            revision_name: process.env.K_REVISION || 'local'
          }
        },
        points: [dataPoint]
      };

      await metricClient.createTimeSeries({
        name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}`,
        timeSeries: [timeSeriesData]
      });
    } catch (error) {
      console.error('Error reporting metrics:', error);
    }

    // Return appropriate status code based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 207 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Readiness probe endpoint
router.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Liveness probe endpoint
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

export default router; 
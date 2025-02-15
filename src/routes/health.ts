import { Router } from 'express';
import { getDb } from '../core/database/database.service';
import { elasticClient } from '../services/elastic-client';
import { WebSocketService } from '../core/services/websocket.service';
import logger from '../core/utils/logger';

const router = Router();

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: 'ok' | 'error';
      latency?: number;
      error?: string;
    };
    elasticsearch: {
      status: 'ok' | 'error';
      latency?: number;
      error?: string;
    };
    websocket: {
      status: 'ok' | 'error';
      connections: number;
      error?: string;
    };
  };
}

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: { status: 'ok' },
      elasticsearch: { status: 'ok' },
      websocket: { status: 'ok', connections: 0 },
    },
  };

  try {
    // Check MongoDB
    const dbStartTime = Date.now();
    const db = getDb();
    await db.command({ ping: 1 });
    status.services.database.latency = Date.now() - dbStartTime;
  } catch (error) {
    status.services.database.status = 'error';
    status.services.database.error = error instanceof Error ? error.message : 'Unknown error';
    status.status = 'error';
    logger.error('Health check - Database error:', error);
  }

  try {
    // Check Elasticsearch
    const esStartTime = Date.now();
    await elasticClient.ping();
    status.services.elasticsearch.latency = Date.now() - esStartTime;
  } catch (error) {
    status.services.elasticsearch.status = 'error';
    status.services.elasticsearch.error = error instanceof Error ? error.message : 'Unknown error';
    status.status = 'error';
    logger.error('Health check - Elasticsearch error:', error);
  }

  try {
    // Check WebSocket
    const wsService = WebSocketService.getInstance();
    status.services.websocket.connections = wsService.getConnectedUsers().length;
  } catch (error) {
    status.services.websocket.status = 'error';
    status.services.websocket.error = error instanceof Error ? error.message : 'Unknown error';
    status.status = 'error';
    logger.error('Health check - WebSocket error:', error);
  }

  // Calculate total response time
  const totalLatency = Date.now() - startTime;

  // Log health check results
  logger.info('Health check completed', {
    status: status.status,
    latency: totalLatency,
    services: status.services,
  });

  // Return appropriate status code
  res.status(status.status === 'ok' ? 200 : 503).json(status);
});

// Detailed health check for Kubernetes liveness probe
router.get('/health/liveness', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Detailed health check for Kubernetes readiness probe
router.get('/health/readiness', async (req, res) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    await elasticClient.ping();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Service not ready' });
  }
});

export default router; 
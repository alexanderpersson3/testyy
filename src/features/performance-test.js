import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import { executeQuery } from '../db.js';
import { warmCache, getCacheStats, PATTERNS, CACHE_TTL } from '../middleware/cache.js';
import monitor from '../services/performance-monitor.js';
import { trackApiRequest } from '../utils/performance-logger.js';

const router = express.Router();

// Test database performance
router.post('/test/database', authenticateAdmin, async (req, res) => {
  const results = await trackApiRequest('database_performance_test', async () => {
    const tests = [];

    // Test single document read
    const singleReadStart = process.hrtime();
    await executeQuery(
      'recipes',
      async collection => collection.findOne({}),
      'perf_test_single_read'
    );
    const singleReadTime = process.hrtime(singleReadStart);
    tests.push({
      name: 'single_read',
      duration: singleReadTime[0] * 1000 + singleReadTime[1] / 1000000,
    });

    // Test bulk read
    const bulkReadStart = process.hrtime();
    await executeQuery(
      'recipes',
      async collection => collection.find({}).limit(100).toArray(),
      'perf_test_bulk_read'
    );
    const bulkReadTime = process.hrtime(bulkReadStart);
    tests.push({
      name: 'bulk_read',
      duration: bulkReadTime[0] * 1000 + bulkReadTime[1] / 1000000,
    });

    // Test write performance
    const writeStart = process.hrtime();
    await executeQuery(
      'performance_test',
      async collection =>
        collection.insertOne({
          test: true,
          timestamp: new Date(),
        }),
      'perf_test_write'
    );
    const writeTime = process.hrtime(writeStart);
    tests.push({
      name: 'write',
      duration: writeTime[0] * 1000 + writeTime[1] / 1000000,
    });

    // Test index performance
    const indexStart = process.hrtime();
    await executeQuery(
      'recipes',
      async collection =>
        collection
          .find({
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          })
          .toArray(),
      'perf_test_index'
    );
    const indexTime = process.hrtime(indexStart);
    tests.push({
      name: 'indexed_query',
      duration: indexTime[0] * 1000 + indexTime[1] / 1000000,
    });

    return tests;
  });

  res.json(results);
});

// Test cache performance
router.post('/test/cache', authenticateAdmin, async (req, res) => {
  const results = await trackApiRequest('cache_performance_test', async () => {
    const tests = [];

    // Test cache write
    const writeStart = process.hrtime();
    await warmCache('perf_test_key', CACHE_TTL.SHORT, async () => ({
      test: true,
      timestamp: new Date(),
    }));
    const writeTime = process.hrtime(writeStart);
    tests.push({
      name: 'cache_write',
      duration: writeTime[0] * 1000 + writeTime[1] / 1000000,
    });

    // Test cache read (hit)
    const readStart = process.hrtime();
    await warmCache('perf_test_key', CACHE_TTL.SHORT, async () => ({
      test: true,
      timestamp: new Date(),
    }));
    const readTime = process.hrtime(readStart);
    tests.push({
      name: 'cache_read_hit',
      duration: readTime[0] * 1000 + readTime[1] / 1000000,
    });

    // Get cache statistics
    const stats = await getCacheStats();
    tests.push({
      name: 'cache_stats',
      stats,
    });

    return tests;
  });

  res.json(results);
});

// Test API response times
router.post('/test/api', authenticateAdmin, async (req, res) => {
  const results = await trackApiRequest('api_performance_test', async () => {
    return monitor.getAllRouteStats();
  });

  res.json(results);
});

// Load test simulation
router.post('/test/load', authenticateAdmin, async (req, res) => {
  const { duration = 10, concurrency = 10 } = req.body;

  const results = await trackApiRequest('load_test', async () => {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    const tests = [];

    // Simulate concurrent requests
    const requests = Array(concurrency)
      .fill()
      .map(async () => {
        const requestResults = [];
        while (Date.now() < endTime) {
          const start = process.hrtime();

          // Perform a mix of operations
          await Promise.all([
            executeQuery('recipes', async collection => collection.findOne({}), 'load_test_read'),
            warmCache(`load_test_${Date.now()}`, CACHE_TTL.SHORT, async () => ({
              timestamp: Date.now(),
            })),
          ]);

          const time = process.hrtime(start);
          requestResults.push({
            timestamp: Date.now(),
            duration: time[0] * 1000 + time[1] / 1000000,
          });
        }
        return requestResults;
      });

    const allResults = await Promise.all(requests);

    // Calculate statistics
    const durations = allResults.flat().map(r => r.duration);
    tests.push({
      name: 'load_test_results',
      totalRequests: durations.length,
      avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      p95ResponseTime: monitor.calculatePercentile(durations, 95),
      requestsPerSecond: durations.length / duration,
    });

    return tests;
  });

  res.json(results);
});

// Memory leak test
router.post('/test/memory', authenticateAdmin, async (req, res) => {
  const { duration = 60 } = req.body;

  const results = await trackApiRequest('memory_test', async () => {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    const memorySnapshots = [];

    // Take memory snapshots every second
    while (Date.now() < endTime) {
      const memory = process.memoryUsage();
      memorySnapshots.push({
        timestamp: Date.now(),
        ...memory,
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate memory growth
    const initial = memorySnapshots[0];
    const final = memorySnapshots[memorySnapshots.length - 1];
    const growth = {
      heapUsed: final.heapUsed - initial.heapUsed,
      heapTotal: final.heapTotal - initial.heapTotal,
      external: final.external - initial.external,
      rss: final.rss - initial.rss,
    };

    return {
      name: 'memory_test_results',
      duration,
      snapshots: memorySnapshots,
      growth,
      growthPerSecond: {
        heapUsed: growth.heapUsed / duration,
        heapTotal: growth.heapTotal / duration,
        external: growth.external / duration,
        rss: growth.rss / duration,
      },
    };
  });

  res.json(results);
});

export default router;

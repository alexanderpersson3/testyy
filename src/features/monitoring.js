import express from 'express';
import monitor from '../services/performance-monitor.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all route statistics
router.get('/metrics', authenticateAdmin, (req, res) => {
  const stats = monitor.getAllRouteStats();
  res.json(stats);
});

// Get specific route statistics
router.get('/metrics/:method/:path(*)', authenticateAdmin, (req, res) => {
  const { method, path } = req.params;
  const stats = monitor.getRouteStats(method, path);

  if (!stats) {
    return res.status(404).json({ error: 'No metrics found for this route' });
  }

  res.json(stats);
});

// Update performance thresholds
router.put('/thresholds', authenticateAdmin, (req, res) => {
  const { responseTime, memoryUsage, cpuUsage } = req.body;

  const newThresholds = {};
  if (responseTime) newThresholds.responseTime = responseTime;
  if (memoryUsage) newThresholds.memoryUsage = memoryUsage;
  if (cpuUsage) newThresholds.cpuUsage = cpuUsage;

  monitor.setThresholds(newThresholds);
  res.json({ message: 'Thresholds updated successfully' });
});

// Clear all metrics
router.delete('/metrics', authenticateAdmin, (req, res) => {
  monitor.clearMetrics();
  res.json({ message: 'Metrics cleared successfully' });
});

export default router;

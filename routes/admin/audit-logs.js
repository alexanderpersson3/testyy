const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const auth = require('../../middleware/auth');
const auditLogger = require('../../services/audit-logger');
const { getDb } = require('../../db');

// Helper function to check if user is admin
async function isAdmin(userId) {
  const db = getDb();
  const user = await db.collection('users').findOne({
    _id: new ObjectId(userId)
  });
  return user && user.role === 'admin';
}

// Get audit logs with filtering and pagination
router.get('/', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view audit logs'
      });
    }

    const {
      eventType,
      severity,
      userId,
      status,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const filters = {};
    if (eventType) filters.eventType = eventType;
    if (severity) filters.severity = severity;
    if (userId) filters.userId = userId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    };

    const result = await auditLogger.query(filters, options);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit logs'
    });
  }
});

// Get audit log statistics
router.get('/stats', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view audit stats'
      });
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const stats = await auditLogger.getEventStats(startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit stats'
    });
  }
});

// Clean up old audit logs
router.post('/cleanup', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can clean up audit logs'
      });
    }

    const { retentionDays } = req.body;
    if (!retentionDays || retentionDays < 30) {
      return res.status(400).json({
        success: false,
        message: 'Retention days must be at least 30'
      });
    }

    const result = await auditLogger.cleanup(retentionDays);

    // Log the cleanup action
    await auditLogger.log(
      auditLogger.eventTypes.ADMIN.SYSTEM_UPDATE,
      {
        action: 'audit_cleanup',
        retentionDays,
        deletedCount: result.deletedCount
      },
      {
        userId: req.user.id,
        severity: auditLogger.severityLevels.INFO
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error cleaning up audit logs'
    });
  }
});

// Get available event types and severity levels
router.get('/metadata', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view audit metadata'
      });
    }

    res.json({
      success: true,
      data: {
        eventTypes: auditLogger.eventTypes,
        severityLevels: auditLogger.severityLevels
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit metadata'
    });
  }
});

// Export audit logs
router.post('/export', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can export audit logs'
      });
    }

    const { startDate, endDate, format = 'json' } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const filters = { startDate, endDate };
    const { logs } = await auditLogger.query(filters, { limit: 10000 });

    // Log the export action
    await auditLogger.log(
      auditLogger.eventTypes.ADMIN.SYSTEM_UPDATE,
      {
        action: 'audit_export',
        startDate,
        endDate,
        format,
        recordCount: logs.length
      },
      {
        userId: req.user.id,
        severity: auditLogger.severityLevels.INFO
      }
    );

    if (format === 'csv') {
      // Convert to CSV format
      const fields = ['eventType', 'timestamp', 'severity', 'userId', 'status', 'ipAddress'];
      const csv = logs.map(log => 
        fields.map(field => JSON.stringify(log[field] || '')).join(',')
      );
      csv.unshift(fields.join(','));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
      res.send(csv.join('\n'));
    } else {
      res.json({
        success: true,
        data: logs
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error exporting audit logs'
    });
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const queryOptimizer = require('../../services/query-optimizer');

// Helper function to check if user is admin
async function isAdmin(userId) {
  const db = getDb();
  const user = await db.collection('users').findOne({
    _id: new ObjectId(userId),
  });
  return user && user.role === 'admin';
}

// Setup database indexes
router.post('/setup-indexes', auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can manage indexes',
      });
    }

    await queryOptimizer.setupIndexes();

    res.json({
      success: true,
      message: 'Indexes setup completed',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error setting up indexes',
    });
  }
});

// Analyze query performance
router.post('/analyze-query', auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can analyze queries',
      });
    }

    const { collection, query, sort } = req.body;
    const analysis = await queryOptimizer.analyzeQuery(collection, query, sort);

    if (!analysis) {
      return res.status(400).json({
        success: false,
        message: 'Error analyzing query',
      });
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error analyzing query',
    });
  }
});

// Get collection statistics
router.get('/stats/:collection', auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view collection stats',
      });
    }

    const { collection } = req.params;
    const stats = await queryOptimizer.getCollectionStats(collection);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching collection stats',
    });
  }
});

// Get index statistics
router.get('/indexes/:collection', auth, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view index stats',
      });
    }

    const { collection } = req.params;
    const stats = await queryOptimizer.getIndexStats(collection);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching index stats',
    });
  }
});

module.exports = router;

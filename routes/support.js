import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rate-limit.js';

const router = Router();

// Validation schemas
const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'other']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.string().min(1).max(100),
  metadata: z.object({
    device: z.string().optional(),
    os: z.string().optional(),
    appVersion: z.string().optional(),
    url: z.string().optional()
  }).optional(),
  attachments: z.array(z.string().url()).optional()
});

const supportTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  category: z.enum(['account', 'billing', 'technical', 'recipe', 'other']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  attachments: z.array(z.string().url()).optional()
});

const ticketReplySchema = z.object({
  message: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).optional(),
  isInternal: z.boolean().default(false)
});

// Submit feedback
router.post('/feedback', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = feedbackSchema.parse(req.body);

    const feedback = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      status: 'pending',
      upvotes: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('feedback').insertOne(feedback);
    
    // Create notification for high priority feedback
    if (feedback.priority === 'high') {
      const admins = await db.collection('users')
        .find({ role: 'admin' })
        .toArray();

      const notifications = admins.map(admin => ({
        userId: admin._id,
        type: 'HIGH_PRIORITY_FEEDBACK',
        title: 'High Priority Feedback Received',
        message: `New high priority ${feedback.type}: ${feedback.title}`,
        data: {
          feedbackId: result.insertedId
        },
        createdAt: new Date()
      }));

      await db.collection('notifications').insertMany(notifications);
    }

    const createdFeedback = await db.collection('feedback').findOne({
      _id: result.insertedId
    });

    res.status(201).json(createdFeedback);
  } catch (error) {
    throw error;
  }
});

// Get user's feedback submissions
router.get('/feedback', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, type, status } = req.query;

    const query = {
      userId: new ObjectId(req.user.id)
    };
    if (type) query.type = type;
    if (status) query.status = status;

    const feedback = await db.collection('feedback')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('feedback').countDocuments(query);

    res.json({
      feedback,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Upvote feedback
router.post('/feedback/:id/upvote', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const feedbackId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const result = await db.collection('feedback').findOneAndUpdate(
      { _id: feedbackId },
      {
        $addToSet: { upvotes: userId },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Create support ticket
router.post('/tickets', authenticateToken, rateLimiter.medium(), async (req, res) => {
  try {
    const db = getDb();
    const validatedData = supportTicketSchema.parse(req.body);

    const ticket = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      status: 'open',
      assignedTo: null,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('support_tickets').insertOne(ticket);

    // Create notification for support team
    const supportTeam = await db.collection('users')
      .find({ role: { $in: ['admin', 'support'] } })
      .toArray();

    const notifications = supportTeam.map(member => ({
      userId: member._id,
      type: 'NEW_SUPPORT_TICKET',
      title: 'New Support Ticket',
      message: `New ${ticket.priority} priority ticket: ${ticket.subject}`,
      data: {
        ticketId: result.insertedId
      },
      createdAt: new Date()
    }));

    await db.collection('notifications').insertMany(notifications);

    const createdTicket = await db.collection('support_tickets').findOne({
      _id: result.insertedId
    });

    res.status(201).json(createdTicket);
  } catch (error) {
    throw error;
  }
});

// Get user's support tickets
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, status } = req.query;

    const query = {
      userId: new ObjectId(req.user.id)
    };
    if (status) query.status = status;

    const tickets = await db.collection('support_tickets')
      .find(query)
      .sort({ updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('support_tickets').countDocuments(query);

    res.json({
      tickets,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Get specific support ticket
router.get('/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const ticketId = new ObjectId(req.params.id);

    const ticket = await db.collection('support_tickets')
      .aggregate([
        {
          $match: {
            _id: ticketId,
            userId: new ObjectId(req.user.id)
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assignedToUser'
          }
        },
        { $unwind: { path: '$assignedToUser', preserveNullAndEmptyArrays: true } }
      ])
      .next();

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    throw error;
  }
});

// Reply to support ticket
router.post('/tickets/:id/reply', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const ticketId = new ObjectId(req.params.id);
    const validatedData = ticketReplySchema.parse(req.body);

    const reply = {
      ...validatedData,
      userId: new ObjectId(req.user.id),
      createdAt: new Date()
    };

    const result = await db.collection('support_tickets').findOneAndUpdate(
      {
        _id: ticketId,
        userId: new ObjectId(req.user.id)
      },
      {
        $push: { replies: reply },
        $set: { 
          status: 'awaiting_response',
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    // Create notification for support team
    if (result.value.assignedTo) {
      await db.collection('notifications').insertOne({
        userId: result.value.assignedTo,
        type: 'TICKET_REPLY',
        title: 'New Ticket Reply',
        message: `New reply on ticket: ${result.value.subject}`,
        data: {
          ticketId
        },
        createdAt: new Date()
      });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Get all feedback
router.get('/admin/feedback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, type, status, priority } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const feedback = await db.collection('feedback')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('feedback').countDocuments(query);

    res.json({
      feedback,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Update feedback status
router.patch('/admin/feedback/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const feedbackId = new ObjectId(req.params.id);
    const { status, adminComment } = z.object({
      status: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
      adminComment: z.string().min(1).max(1000).optional()
    }).parse(req.body);

    const result = await db.collection('feedback').findOneAndUpdate(
      { _id: feedbackId },
      {
        $set: {
          status,
          ...(adminComment && { adminComment }),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Notify user of status change
    await db.collection('notifications').insertOne({
      userId: result.value.userId,
      type: 'FEEDBACK_STATUS_UPDATE',
      title: 'Feedback Status Updated',
      message: `Your feedback "${result.value.title}" has been marked as ${status}`,
      data: {
        feedbackId,
        status
      },
      createdAt: new Date()
    });

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

// Admin: Get all support tickets
router.get('/admin/tickets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, status, category, priority } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const tickets = await db.collection('support_tickets')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assignedToUser'
          }
        },
        { $unwind: { path: '$assignedToUser', preserveNullAndEmptyArrays: true } },
        { $sort: { updatedAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
      .toArray();

    const total = await db.collection('support_tickets').countDocuments(query);

    res.json({
      tickets,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    throw error;
  }
});

// Admin: Update support ticket
router.patch('/admin/tickets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const ticketId = new ObjectId(req.params.id);
    const { status, assignedTo, internalNote } = z.object({
      status: z.enum(['open', 'in_progress', 'awaiting_response', 'resolved', 'closed']).optional(),
      assignedTo: z.string().optional(),
      internalNote: z.string().min(1).max(1000).optional()
    }).parse(req.body);

    const updates = {
      ...(status && { status }),
      ...(assignedTo && { assignedTo: new ObjectId(assignedTo) }),
      updatedAt: new Date()
    };

    if (internalNote) {
      updates.$push = {
        internalNotes: {
          note: internalNote,
          userId: new ObjectId(req.user.id),
          createdAt: new Date()
        }
      };
    }

    const result = await db.collection('support_tickets').findOneAndUpdate(
      { _id: ticketId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    // Notify user of status change if status was updated
    if (status) {
      await db.collection('notifications').insertOne({
        userId: result.value.userId,
        type: 'TICKET_STATUS_UPDATE',
        title: 'Support Ticket Updated',
        message: `Your support ticket has been marked as ${status}`,
        data: {
          ticketId,
          status
        },
        createdAt: new Date()
      });
    }

    res.json(result.value);
  } catch (error) {
    throw error;
  }
});

export default router; 
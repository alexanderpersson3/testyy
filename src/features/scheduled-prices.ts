import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { db } from '../db.js';

const router = express.Router();

// Schedule configuration
const SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const MAX_SCHEDULES_PER_USER = 10;

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

interface Schedule {
  _id?: ObjectId;
  ingredientId: ObjectId;
  userId: ObjectId;
  type: string;
  time: string;
  timezone: string;
  isActive: boolean;
  lastRun: Date | null;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Create price update schedule
router.post('/schedules', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = await db.getDb();
    const { ingredientId, type, time, timezone } = req.body;

    // Validate schedule type
    if (!SCHEDULE_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule type',
      });
    }

    // Check schedule limit
    const scheduleCount = await database.collection('priceSchedules').countDocuments({
      userId: new ObjectId(req.user!.id),
    });

    if (scheduleCount >= MAX_SCHEDULES_PER_USER) {
      return res.status(400).json({
        success: false,
        message: 'Maximum schedule limit reached',
      });
    }

    const schedule: Schedule = {
      ingredientId: new ObjectId(ingredientId),
      userId: new ObjectId(req.user!.id),
      type,
      time,
      timezone,
      isActive: true,
      lastRun: null,
      nextRun: calculateNextRun(type, time, timezone),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await database.collection('priceSchedules').insertOne(schedule);
    schedule._id = result.insertedId;

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating schedule',
    });
  }
});

// Get user's schedules
router.get('/schedules', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = await db.getDb();

    const schedules = await database
      .collection('priceSchedules')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(req.user!.id),
          },
        },
        {
          $lookup: {
            from: 'ingredients',
            localField: 'ingredientId',
            foreignField: '_id',
            as: 'ingredient',
          },
        },
        {
          $unwind: '$ingredient',
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: schedules,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
    });
  }
});

// Update schedule
router.put('/schedules/:scheduleId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = await db.getDb();
    const { scheduleId } = req.params;
    const { type, time, timezone, isActive } = req.body;

    const schedule = await database.collection('priceSchedules').findOne({
      _id: new ObjectId(scheduleId),
      userId: new ObjectId(req.user!.id),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      });
    }

    if (type && !SCHEDULE_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule type',
      });
    }

    const update = {
      $set: { // Use $set for partial updates
        type: type || schedule.type,
        time: time || schedule.time,
        timezone: timezone || schedule.timezone,
        isActive: isActive !== undefined ? isActive : schedule.isActive,
        nextRun: calculateNextRun(
          type || schedule.type,
          time || schedule.time,
          timezone || schedule.timezone
        ),
        updatedAt: new Date(),
      },
    };

    await database.collection('priceSchedules').updateOne({ _id: new ObjectId(scheduleId) }, update);

    res.json({
      success: true,
      message: 'Schedule updated successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating schedule',
    });
  }
});

// Delete schedule
router.delete('/schedules/:scheduleId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = await db.getDb();
    const { scheduleId } = req.params;

    const result = await database.collection('priceSchedules').deleteOne({
      _id: new ObjectId(scheduleId),
      userId: new ObjectId(req.user!.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Error deleting schedule',
    });
  }
});

// Helper function to calculate next run time
function calculateNextRun(type: string, time: string, timezone: string): Date {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  let nextRun = new Date(now);

  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    switch (type) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
  }

  return nextRun;
}

export default router;
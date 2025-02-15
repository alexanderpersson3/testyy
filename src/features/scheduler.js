const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class PriceUpdateScheduler {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // Check every minute
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('Price update scheduler started');
    this.scheduleNextCheck();
  }

  async stop() {
    this.isRunning = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    console.log('Price update scheduler stopped');
  }

  scheduleNextCheck() {
    if (!this.isRunning) return;

    this.timeout = setTimeout(async () => {
      await this.checkSchedules();
      this.scheduleNextCheck();
    }, this.checkInterval);
  }

  async checkSchedules() {
    try {
      const db = getDb();
      const now = new Date();

      // Find schedules that need to be run
      const schedules = await db
        .collection('priceSchedules')
        .find({
          isActive: true,
          nextRun: { $lte: now },
        })
        .toArray();

      for (const schedule of schedules) {
        await this.processSchedule(schedule);
      }
    } catch (err) {
      console.error('Error checking schedules:', err);
    }
  }

  async processSchedule(schedule) {
    try {
      const db = getDb();
      const now = new Date();

      // Get current price for the ingredient
      const ingredient = await db.collection('ingredients').findOne({
        _id: schedule.ingredientId,
      });

      if (!ingredient) {
        console.error(`Ingredient not found for schedule ${schedule._id}`);
        return;
      }

      // Record price history
      await db.collection('priceHistory').insertOne({
        ingredientId: schedule.ingredientId,
        price: ingredient.currentPrice,
        store: ingredient.store,
        timestamp: now,
        source: 'scheduled',
      });

      // Update schedule's last run and next run times
      const nextRun = calculateNextRun(schedule.type, schedule.time, schedule.timezone);

      await db.collection('priceSchedules').updateOne(
        { _id: schedule._id },
        {
          $set: {
            lastRun: now,
            nextRun,
            updatedAt: now,
          },
        }
      );

      // Check price alerts
      await this.checkPriceAlerts(ingredient);
    } catch (err) {
      console.error(`Error processing schedule ${schedule._id}:`, err);
    }
  }

  async checkPriceAlerts(ingredient) {
    try {
      const db = getDb();

      // Find relevant alerts
      const alerts = await db
        .collection('priceAlerts')
        .find({
          ingredientId: ingredient._id,
          triggered: false,
        })
        .toArray();

      for (const alert of alerts) {
        const shouldTrigger =
          alert.type === 'below'
            ? ingredient.currentPrice <= alert.targetPrice
            : ingredient.currentPrice >= alert.targetPrice;

        if (shouldTrigger) {
          await db.collection('priceAlerts').updateOne(
            { _id: alert._id },
            {
              $set: {
                triggered: true,
                triggerPrice: ingredient.currentPrice,
                triggeredAt: new Date(),
              },
            }
          );

          // Here you would typically send a notification to the user
          // This will be implemented when we add the notification system
        }
      }
    } catch (err) {
      console.error('Error checking price alerts:', err);
    }
  }
}

function calculateNextRun(type, time, timezone) {
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

module.exports = new PriceUpdateScheduler();

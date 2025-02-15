;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { MongoClient, ChangeStream } from 'mongodb';;
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';;
import { VoiceService } from '../voice.service.js';;
import type { Recipe } from '../types/express.js';
import { WebSocketService } from '../websocket.service.js';;
import { Timer, TimerGroup, TimerEvent, TimerAlert, TimerEventType, CreateTimerDTO, CreateTimerGroupDTO, TimerStats, TimerUnit,  } from '../types/timer.js';;
import { db } from '../db/database.service.js';;
import { DatabaseService } from '../db/database.service.js';;

export class EnhancedTimerService {
  private static instance: EnhancedTimerService;
  private timerEmitter: EventEmitter;
  private activeTimers: Map<string, NodeJS.Timeout>;
  private voiceService: VoiceService;
  private wsService: WebSocketService;
  private db: DatabaseService;
  private initialized: boolean = false;
  private timersCollection!: Collection<Timer>;
  private timerGroupsCollection!: Collection<TimerGroup>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.timerEmitter = new EventEmitter();
    this.activeTimers = new Map();
    this.voiceService = VoiceService.getInstance();
    this.wsService = WebSocketService.getInstance();

    // Set up error handling for the event emitter
    this.timerEmitter.on('error', error => {
      logger.error('Timer event emitter error:', error);
    });

    // Clean up intervals on process exit
    process.on('exit', () => {
      this.activeTimers.forEach(timeout => {
        clearTimeout(timeout);
      });
    });

    // Initialize database connection
    this.initialize().catch(error => {
      logger.error('Failed to initialize EnhancedTimerService:', error);
    });

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.timersCollection = this.db.getCollection<Timer>('timers');
      this.timerGroupsCollection = this.db.getCollection<TimerGroup>('timer_groups');
      this.initialized = true;
      logger.info('EnhancedTimerService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EnhancedTimerService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  static getInstance(): EnhancedTimerService {
    if (!EnhancedTimerService.instance) {
      EnhancedTimerService.instance = new EnhancedTimerService();
    }
    return EnhancedTimerService.instance;
  }

  /**
   * Set up WebSocket event handlers for timer synchronization
   */
  private setupWebSocketHandlers(): void {
    this.timerEmitter.on('timer:alert', (event: TimerEvent) => {
      if (event.type === 'timer:alert') {
        this.wsService.emitToUser(event.userId, 'timer:alert', {
          type: event.type,
          timestamp: Date.now(),
          data: event.data,
        });
      }
    });

    this.timerEmitter.on('timer:update', (event: TimerEvent) => {
      if (event.type === 'timer:update') {
        this.wsService.emitToUser(event.userId, 'timer:update', {
          type: event.type,
          timestamp: Date.now(),
          data: event.data,
        });
      }
    });

    this.timerEmitter.on('timer:complete', (event: TimerEvent) => {
      if (event.type === 'timer:complete') {
        this.wsService.emitToUser(event.userId, 'timer:complete', {
          type: event.type,
          timestamp: Date.now(),
          data: event.data,
        });
      }
    });

    this.timerEmitter.on('group:update', (event: TimerEvent) => {
      if (event.type === 'group:update') {
        this.wsService.emitToUser(event.userId, 'group:update', {
          type: event.type,
          timestamp: Date.now(),
          data: event.data,
        });
      }
    });
  }

  /**
   * Emit a timer event
   */
  private emitTimerEvent(type: TimerEventType, userId: ObjectId, data: any): void {
    const event: TimerEvent = {
      type,
      userId,
      timestamp: new Date(),
      data,
    };

    try {
      this.timerEmitter.emit(type, event);
    } catch (error) {
      logger.error('Error emitting timer event:', {
        type,
        userId: userId.toString(),
        error,
      });
    }
  }

  /**
   * Create a timer
   */
  async createTimer(userId: ObjectId, data: CreateTimerDTO): Promise<Timer> {
    await this.ensureInitialized();
    
    const now = new Date();
    
    const timer: Timer = {
      _id: new ObjectId(),
      userId,
      label: data.label,
      duration: data.duration,
      unit: 'seconds',
      status: 'pending',
      alerts: data.alerts?.map(alert => ({ ...alert, sent: false })) || [
        {
          type: 'notification',
          time: 0,
          message: 'Timer completed!',
          sent: false,
        },
      ],
      priority: data.priority || 'medium',
      notes: data.notes,
      recipeId: data.recipeId,
      stepNumber: data.stepNumber,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.timersCollection.insertOne(timer);
    return { ...timer, _id: result.insertedId };
  }

  /**
   * Create a timer group
   */
  async createTimerGroup(userId: ObjectId, data: CreateTimerGroupDTO): Promise<TimerGroup> {
    await this.ensureInitialized();

    // Create all timers
    const timers = await Promise.all(
      data.timerConfigs.map(config =>
        this.createTimer(userId, {
          recipeId: data.recipeId,
          ...config,
        })
      )
    );

    const now = new Date();
    const group: TimerGroup = {
      _id: new ObjectId(),
      userId,
      recipeId: data.recipeId,
      name: data.name,
      timers: timers.map(t => t._id),
      sequence: data.sequence,
      status: 'pending',
      progress: {
        completed: 0,
        total: timers.length,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.timerGroupsCollection.insertOne(group);
    return { ...group, _id: result.insertedId };
  }

  /**
   * Get MongoDB client for watch operations
   */
  private async getMongoClient(): Promise<MongoClient> {
    const dbService = DatabaseService.getInstance();
    await dbService.connect();
    const client = (dbService as unknown as { client: MongoClient }).client;
    if (!client) {
      throw new Error('MongoDB client not available');
    }
    return client;
  }

  /**
   * Watch for timer changes
   */
  async watchTimers(userId: ObjectId, callback: (change: any) => void): Promise<void> {
    const client = await this.getMongoClient();
    const collection = client.db().collection<Timer>('timers');
    const pipeline = [{ $match: { 'fullDocument.userId': userId } }];
    
    const changeStream = collection.watch<Timer>(pipeline);
    changeStream.on('change', callback);
  }

  /**
   * Start timer
   */
  async startTimer(timerId: ObjectId): Promise<Timer> {
    await this.ensureInitialized();
    const now = new Date();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer) {
      throw new Error('Timer not found');
    }

    if (timer.status !== 'pending' && timer.status !== 'paused') {
      throw new Error('Timer cannot be started');
    }

    const duration = timer.status === 'paused' ? timer.remainingTime! : timer.duration;

    const endTime = new Date(now.getTime() + duration * 1000);

    const updates = {
      startTime: now,
      endTime,
      status: 'running' as const,
    };

    const result = await this.timersCollection
      .findOneAndUpdate({ _id: timerId }, { $set: updates }, { returnDocument: 'after' });

    if (!result.value) {
      throw new Error('Failed to start timer');
    }

    // Schedule alerts for the updated timer
    const updatedTimer: Timer = {
      ...timer,
      ...updates,
    };
    this.scheduleAlerts(updatedTimer);

    // Emit update event
    this.emitTimerEvent('timer:update', timer.userId, updatedTimer);

    return updatedTimer;
  }

  /**
   * Clear alerts for a timer
   */
  private clearAlerts(timerId: string): void {
    this.activeTimers.forEach((timeout: any, key: any) => {
      if (key.startsWith(timerId)) {
        clearTimeout(timeout);
        this.activeTimers.delete(key);
      }
    });
  }

  /**
   * Create timers from recipe instructions
   */
  async createTimersFromRecipe(userId: ObjectId, recipeId: ObjectId): Promise<TimerGroup> {
    await this.ensureInitialized();

    // Get recipe
    const recipe = await this.db.getCollection<Recipe>('recipes').findOne({ _id: recipeId });
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Create timers for instructions with timers
    const timerConfigs = recipe.instructions
      .filter(instruction => instruction.timer)
      .map(instruction => {
        const duration = this.convertToSeconds(
          instruction.timer!.duration,
          instruction.timer!.unit
        );

        return {
          label: `Step ${instruction.step}: ${instruction.text}`,
          duration,
          alerts: instruction.timer!.alerts?.map(alert => ({
            ...alert,
            sent: false,
          })) || [
            {
              type: 'notification' as const,
              time: 0,
              message: `Timer for step ${instruction.step} completed!`,
              sent: false,
            },
          ],
          priority: 'medium' as const,
        };
      });

    if (timerConfigs.length === 0) {
      throw new Error('No timers found in recipe instructions');
    }

    // Create timer group
    return this.createTimerGroup(userId, {
      recipeId,
      name: `Timers for ${recipe.title}`,
      timerConfigs,
      sequence: 'sequential',
    });
  }

  /**
   * Convert time to seconds
   */
  private convertToSeconds(duration: number, unit: TimerUnit): number {
    switch (unit) {
      case 'seconds':
        return duration;
      case 'minutes':
        return duration * 60;
      case 'hours':
        return duration * 3600;
    }
  }

  /**
   * Handle timer completion
   */
  private async handleTimerCompletion(timer: Timer): Promise<void> {
    await this.ensureInitialized();

    try {
      // Update timer status
      await this.timersCollection.updateOne(
        { _id: timer._id },
        {
          $set: {
            status: 'completed',
            endTime: new Date(),
          },
        }
      );

      const updatedTimer = await this.timersCollection.findOne({ _id: timer._id });

      if (!updatedTimer) {
        throw new Error('Failed to update timer');
      }

      // Emit completion event
      this.emitTimerEvent('timer:complete', timer.userId, updatedTimer);

      // If timer is part of a group, handle group progression
      if (timer.groupId) {
        const group = await this.timerGroupsCollection.findOne({ _id: timer.groupId });

        if (group && group.sequence === 'sequential') {
          const currentIndex = group.timers.findIndex(t => t.equals(timer._id!));
          const nextTimer = group.timers[currentIndex + 1];

          if (nextTimer) {
            // Start next timer
            await this.startTimer(nextTimer);
          } else {
            // All timers completed
            await this.timerGroupsCollection.updateOne(
              { _id: group._id },
              {
                $set: {
                  status: 'completed',
                  progress: {
                    completed: group.timers.length,
                    total: group.timers.length,
                  },
                  updatedAt: new Date(),
                },
              }
            );

            const updatedGroup = await this.timerGroupsCollection.findOne({ _id: group._id });

            if (updatedGroup) {
              this.emitTimerEvent('group:update', updatedGroup.userId, updatedGroup);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error handling timer completion:', error);
      throw error;
    }
  }

  /**
   * Schedule alerts for a timer
   */
  private async scheduleAlerts(timer: Timer): Promise<void> {
    const timerId = timer._id!.toString();

    // Clear any existing alerts
    this.clearAlerts(timerId);

    // Schedule new alerts
    timer.alerts
      .filter(alert => !alert.sent)
      .forEach(alert => {
        const alertTime = timer.endTime!.getTime() - alert.time * 1000;
        const delay = alertTime - Date.now();

        if (delay > 0) {
          const timeout = setTimeout(async () => {
            try {
              // Check if alert should still be sent
              const currentTimer = await this.timersCollection.findOne({ _id: timer._id });

              if (
                currentTimer &&
                currentTimer.status === 'running' &&
                !currentTimer.alerts.find(
                  a => a.time === alert.time && a.type === alert.type && a.sent
                )
              ) {
                // Mark alert as sent
                await this.timersCollection.updateOne(
                  {
                    _id: timer._id,
                    'alerts.time': alert.time,
                    'alerts.type': alert.type,
                  },
                  {
                    $set: {
                      'alerts.$.sent': true,
                      updatedAt: new Date(),
                    },
                  }
                );

                const updatedTimer = await this.timersCollection.findOne({ _id: timer._id });

                if (updatedTimer) {
                  // Emit alert event
                  this.emitTimerEvent('timer:alert', updatedTimer.userId, {
                    timerId: updatedTimer._id,
                    type: alert.type,
                    message: alert.message,
                  });

                  // Handle voice alerts
                  if (alert.type === 'voice') {
                    try {
                      await this.voiceService.speak(alert.message);
                    } catch (error) {
                      logger.error('Error playing voice alert:', error);
                    }
                  }

                  // Emit timer update
                  this.emitTimerEvent('timer:update', updatedTimer.userId, updatedTimer);
                }
              }
            } catch (error) {
              logger.error('Error processing timer alert:', {
                timerId,
                alertTime: alert.time,
                error,
              });
            }
          }, delay);

          this.activeTimers.set(`${timerId}-${alert.time}`, timeout);
        }
      });
  }

  /**
   * Get active timers
   */
  async getActiveTimers(userId: ObjectId): Promise<Timer[]> {
    await this.ensureInitialized();

    return this.timersCollection
      .find({
        userId,
        status: { $in: ['running', 'paused'] },
      })
      .sort({ priority: -1, startTime: 1 })
      .toArray();
  }

  /**
   * Get timer groups
   */
  async getTimerGroups(
    userId: ObjectId,
    recipeId?: ObjectId
  ): Promise<Array<Omit<TimerGroup, 'timers'> & { timers: Timer[] }>> {
    await this.ensureInitialized();

    const query: any = { userId };
    if (recipeId) {
      query.recipeId = recipeId;
    }

    const groups = await this.timerGroupsCollection
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    // Get timer details
    const timerIds = groups.flatMap(g => g.timers);
    const timers = await this.timersCollection
      .find({ _id: { $in: timerIds } })
      .toArray();

    const timerMap = new Map(timers.map(t => [t._id!.toString(), t]));

    return groups.map(({ timers: groupTimers, ...group }) => {
      const mappedTimers = groupTimers
        .map(id => timerMap.get(id.toString()))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);

      return {
        ...group,
        timers: mappedTimers,
      };
    });
  }

  /**
   * Start timer group
   */
  async startTimerGroup(groupId: ObjectId): Promise<TimerGroup> {
    await this.ensureInitialized();

    const group = await this.timerGroupsCollection.findOne({ _id: groupId });
    if (!group) {
      throw new Error('Timer group not found');
    }

    if (group.sequence === 'parallel') {
      // Start all timers
      await Promise.all(group.timers.map(timerId => this.startTimer(timerId)));
    } else {
      // Start first timer
      await this.startTimer(group.timers[0]);
    }

    const updates = {
      status: 'running' as const,
      activeTimer: group.sequence === 'sequential' ? group.timers[0] : undefined,
      updatedAt: new Date(),
    };

    const result = await this.timerGroupsCollection
      .findOneAndUpdate({ _id: groupId }, { $set: updates }, { returnDocument: 'after' });

    if (!result.value) {
      throw new Error('Failed to start timer group');
    }

    return {
      ...group,
      ...updates,
    };
  }

  /**
   * Pause timer
   */
  async pauseTimer(timerId: ObjectId): Promise<Timer> {
    await this.ensureInitialized();
    const now = new Date();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer || timer.status !== 'running') {
      throw new Error('Timer cannot be paused');
    }

    // Calculate remaining time
    const remainingTime = Math.max(
      0,
      Math.floor((timer.endTime!.getTime() - now.getTime()) / 1000)
    );

    // Clear scheduled alerts
    this.clearAlerts(timerId.toString());

    const updates = {
      status: 'paused' as const,
      remainingTime,
    };

    const result = await this.timersCollection
      .findOneAndUpdate({ _id: timerId }, { $set: updates }, { returnDocument: 'after' });

    if (!result.value) {
      throw new Error('Failed to pause timer');
    }

    const updatedTimer = {
      ...timer,
      ...updates,
    };

    // Emit update event
    this.emitTimerEvent('timer:update', updatedTimer.userId, updatedTimer);

    return updatedTimer;
  }

  /**
   * Stop timer
   */
  async stopTimer(timerId: ObjectId): Promise<Timer> {
    await this.ensureInitialized();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer) {
      throw new Error('Timer not found');
    }

    // Clear scheduled alerts
    this.clearAlerts(timerId.toString());

    const updates = {
      status: 'cancelled' as const,
      endTime: new Date(),
    };

    const result = await this.timersCollection
      .findOneAndUpdate({ _id: timerId }, { $set: updates }, { returnDocument: 'after' });

    if (!result.value) {
      throw new Error('Failed to stop timer');
    }

    const updatedTimer = {
      ...timer,
      ...updates,
    };

    // Emit update event
    this.emitTimerEvent('timer:update', updatedTimer.userId, updatedTimer);

    return updatedTimer;
  }

  /**
   * Bulk start multiple timers
   */
  async startTimers(timerIds: ObjectId[]): Promise<Timer[]> {
    return Promise.all(timerIds.map(id => this.startTimer(id)));
  }

  /**
   * Bulk pause multiple timers
   */
  async pauseTimers(timerIds: ObjectId[]): Promise<Timer[]> {
    return Promise.all(timerIds.map(id => this.pauseTimer(id)));
  }

  /**
   * Bulk stop multiple timers
   */
  async stopTimers(timerIds: ObjectId[]): Promise<Timer[]> {
    return Promise.all(timerIds.map(id => this.stopTimer(id)));
  }

  /**
   * Synchronize a timer with the server time
   */
  async syncTimer(timerId: ObjectId): Promise<Timer> {
    await this.ensureInitialized();
    const now = new Date();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer) {
      throw new Error('Timer not found');
    }

    if (timer.status !== 'running') {
      return timer;
    }

    // Calculate new remaining time
    const remainingTime = Math.max(
      0,
      Math.floor((timer.endTime!.getTime() - now.getTime()) / 1000)
    );

    if (remainingTime === 0) {
      // Timer has completed
      await this.handleTimerCompletion(timer);
      const updatedTimer = await this.timersCollection.findOne({ _id: timerId });
      if (!updatedTimer) {
        throw new Error('Timer not found after completion');
      }
      return updatedTimer;
    }

    // Reschedule alerts if needed
    this.clearAlerts(timerId.toString());
    this.scheduleAlerts(timer);

    return timer;
  }

  /**
   * Get timer statistics for a user
   */
  async getTimerStats(userId: ObjectId): Promise<TimerStats> {
    await this.ensureInitialized();

    const timers = await this.timersCollection.find({ userId }).toArray();

    const completed = timers.filter(t => t.status === 'completed').length;
    const cancelled = timers.filter(t => t.status === 'cancelled').length;
    const completedTimers = timers.filter(t => t.status === 'completed');

    const totalTime = completedTimers.reduce((sum: any, timer: any) => {
      const duration = timer.endTime!.getTime() - timer.startTime!.getTime();
      return sum + Math.floor(duration / 1000);
    }, 0);

    return {
      total: timers.length,
      completed,
      cancelled,
      averageDuration: completed > 0 ? Math.floor(totalTime / completed) : 0,
      totalTime,
    };
  }

  /**
   * Reset a timer to its initial state
   */
  async resetTimer(timerId: ObjectId): Promise<Timer> {
    await this.ensureInitialized();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer) {
      throw new Error('Timer not found');
    }

    // Clear any scheduled alerts
    this.clearAlerts(timerId.toString());

    const updates = {
      status: 'pending' as const,
    };

    await this.timersCollection.updateOne(
      { _id: timerId },
      {
        $set: updates,
        $unset: {
          startTime: '',
          endTime: '',
          remainingTime: '',
        },
      }
    );

    const updatedTimer = await this.timersCollection.findOne({ _id: timerId });
    if (!updatedTimer) {
      throw new Error('Timer not found after reset');
    }

    return updatedTimer;
  }

  /**
   * Add alerts to an existing timer
   */
  async addAlerts(
    timerId: ObjectId,
    alerts: Array<Omit<Timer['alerts'][0], 'sent'>>
  ): Promise<Timer> {
    await this.ensureInitialized();

    const timer = await this.timersCollection.findOne({ _id: timerId });
    if (!timer) {
      throw new Error('Timer not found');
    }

    const newAlerts = alerts.map(alert => ({
      ...alert,
      sent: false,
    }));

    await this.timersCollection.updateOne(
      { _id: timerId },
      {
        $push: {
          alerts: {
            $each: newAlerts,
          },
        },
      }
    );

    const updatedTimer = await this.timersCollection.findOne({ _id: timerId });
    if (!updatedTimer) {
      throw new Error('Timer not found after adding alerts');
    }

    if (updatedTimer.status === 'running') {
      // Reschedule alerts if timer is running
      this.clearAlerts(timerId.toString());
      this.scheduleAlerts(updatedTimer);
    }

    return updatedTimer;
  }
}

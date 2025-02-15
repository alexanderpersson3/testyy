import type { ObjectId } from '../types/index.js';
import { Timer, TimerGroup, CreateTimerDTO, CreateTimerGroupDTO, TimerStats } from '../types/timer.js';
export declare class EnhancedTimerService {
    private static instance;
    private timerEmitter;
    private activeTimers;
    private voiceService;
    private wsService;
    private db;
    private initialized;
    private timersCollection;
    private timerGroupsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): EnhancedTimerService;
    /**
     * Set up WebSocket event handlers for timer synchronization
     */
    private setupWebSocketHandlers;
    /**
     * Emit a timer event
     */
    private emitTimerEvent;
    /**
     * Create a timer
     */
    createTimer(userId: ObjectId, data: CreateTimerDTO): Promise<Timer>;
    /**
     * Create a timer group
     */
    createTimerGroup(userId: ObjectId, data: CreateTimerGroupDTO): Promise<TimerGroup>;
    /**
     * Get MongoDB client for watch operations
     */
    private getMongoClient;
    /**
     * Watch for timer changes
     */
    watchTimers(userId: ObjectId, callback: (change: any) => void): Promise<void>;
    /**
     * Start timer
     */
    startTimer(timerId: ObjectId): Promise<Timer>;
    /**
     * Clear alerts for a timer
     */
    private clearAlerts;
    /**
     * Create timers from recipe instructions
     */
    createTimersFromRecipe(userId: ObjectId, recipeId: ObjectId): Promise<TimerGroup>;
    /**
     * Convert time to seconds
     */
    private convertToSeconds;
    /**
     * Handle timer completion
     */
    private handleTimerCompletion;
    /**
     * Schedule alerts for a timer
     */
    private scheduleAlerts;
    /**
     * Get active timers
     */
    getActiveTimers(userId: ObjectId): Promise<Timer[]>;
    /**
     * Get timer groups
     */
    getTimerGroups(userId: ObjectId, recipeId?: ObjectId): Promise<Array<Omit<TimerGroup, 'timers'> & {
        timers: Timer[];
    }>>;
    /**
     * Start timer group
     */
    startTimerGroup(groupId: ObjectId): Promise<TimerGroup>;
    /**
     * Pause timer
     */
    pauseTimer(timerId: ObjectId): Promise<Timer>;
    /**
     * Stop timer
     */
    stopTimer(timerId: ObjectId): Promise<Timer>;
    /**
     * Bulk start multiple timers
     */
    startTimers(timerIds: ObjectId[]): Promise<Timer[]>;
    /**
     * Bulk pause multiple timers
     */
    pauseTimers(timerIds: ObjectId[]): Promise<Timer[]>;
    /**
     * Bulk stop multiple timers
     */
    stopTimers(timerIds: ObjectId[]): Promise<Timer[]>;
    /**
     * Synchronize a timer with the server time
     */
    syncTimer(timerId: ObjectId): Promise<Timer>;
    /**
     * Get timer statistics for a user
     */
    getTimerStats(userId: ObjectId): Promise<TimerStats>;
    /**
     * Reset a timer to its initial state
     */
    resetTimer(timerId: ObjectId): Promise<Timer>;
    /**
     * Add alerts to an existing timer
     */
    addAlerts(timerId: ObjectId, alerts: Array<Omit<Timer['alerts'][0], 'sent'>>): Promise<Timer>;
}

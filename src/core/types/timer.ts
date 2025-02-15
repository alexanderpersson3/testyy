import { ObjectId } from 'mongodb';;;;
import type { BaseDocument } from '../types/express.js';
/**
 * Timer types
 */
export type TimerStatus = 'pending' | 'active' | 'paused' | 'completed' | 'running' | 'cancelled';
export type TimerPriority = 'low' | 'medium' | 'high';
export type TimerAlertType = 'notification' | 'sound' | 'voice' | 'both';
export type TimerSequence = 'parallel' | 'sequential';
export type TimerUnit = 'seconds' | 'minutes' | 'hours';

/**
 * Timer alert configuration
 */
export interface TimerAlert {
  type: TimerAlertType;
  time: number; // seconds before end
  message: string;
  sent: boolean;
  frequency?: number;
  sound?: string;
}

/**
 * Base timer interface
 */
export interface BaseTimer {
  userId: ObjectId;
  recipeId?: ObjectId;
  groupId?: ObjectId;
  stepNumber?: number;
  name?: string;
  label: string;
  duration: number; // in seconds
  unit: TimerUnit;
  startTime?: Date;
  endTime?: Date;
  remainingTime?: number;
  status: TimerStatus;
  alerts: TimerAlert[];
  priority: TimerPriority;
  notes?: string;
}

/**
 * Timer document interface
 */
export interface Timer extends BaseTimer, BaseDocument {}

/**
 * Timer progress interface
 */
export interface TimerProgress {
  completed: number;
  total: number;
}

/**
 * Base timer group interface
 */
export interface BaseTimerGroup {
  userId: ObjectId;
  recipeId: ObjectId;
  name: string;
  timers: ObjectId[];
  sequence: TimerSequence;
  activeTimer?: ObjectId;
  status: Exclude<TimerStatus, 'cancelled'>;
  progress: TimerProgress;
}

/**
 * Timer group document interface
 */
export interface TimerGroup extends BaseTimerGroup, BaseDocument {}

/**
 * Timer creation DTO
 */
export interface CreateTimerDTO {
  recipeId?: ObjectId;
  stepNumber?: number;
  label: string;
  duration: number;
  alerts?: Omit<TimerAlert, 'sent'>[];
  priority?: TimerPriority;
  notes?: string;
}

/**
 * Timer group creation DTO
 */
export interface CreateTimerGroupDTO {
  recipeId: ObjectId;
  name: string;
  timerConfigs: Array<{
    label: string;
    duration: number;
    alerts?: Omit<TimerAlert, 'sent'>[];
    priority?: TimerPriority;
  }>;
  sequence: TimerSequence;
}

/**
 * Timer update DTO
 */
export type UpdateTimerDTO = Partial<Pick<BaseTimer, 'label' | 'duration' | 'priority' | 'notes'>>;

/**
 * Timer group update DTO
 */
export type UpdateTimerGroupDTO = Partial<Pick<BaseTimerGroup, 'name' | 'sequence'>>;

/**
 * Timer stats interface
 */
export interface TimerStats {
  total: number;
  completed: number;
  cancelled: number;
  averageDuration: number;
  totalTime: number;
}

/**
 * Timer event types
 */
export type TimerEventType =
  | 'timer:start'
  | 'timer:pause'
  | 'timer:stop'
  | 'timer:complete'
  | 'timer:update'
  | 'timer:alert'
  | 'group:start'
  | 'group:pause'
  | 'group:stop'
  | 'group:complete'
  | 'group:update';

/**
 * Base timer event interface
 */
export interface BaseTimerEvent {
  type: TimerEventType;
  userId: ObjectId;
  timestamp: Date;
}

/**
 * Timer state event interface
 */
export interface TimerStateEvent extends BaseTimerEvent {
  type: 'timer:start' | 'timer:pause' | 'timer:stop' | 'timer:complete';
  data: Timer;
}

/**
 * Timer update event interface
 */
export interface TimerUpdateEvent extends BaseTimerEvent {
  type: 'timer:update';
  data: Timer;
}

/**
 * Timer alert event interface
 */
export interface TimerAlertEvent extends BaseTimerEvent {
  type: 'timer:alert';
  data: {
    timer: Timer;
    alert: TimerAlert;
  };
}

/**
 * Timer group event interface
 */
export interface TimerGroupEvent extends BaseTimerEvent {
  type: 'group:start' | 'group:pause' | 'group:stop' | 'group:complete' | 'group:update';
  data: TimerGroup;
}

/**
 * Timer event union type
 */
export type TimerEvent = TimerStateEvent | TimerUpdateEvent | TimerAlertEvent | TimerGroupEvent;

/**
 * Timer configuration interface
 */
export interface TimerConfig {
  duration: number;
  unit: TimerUnit;
  alerts: TimerAlert[];
  priority: TimerPriority;
}

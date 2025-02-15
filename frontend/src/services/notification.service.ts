import { ObjectId } from 'mongodb';
import { wsService } from './websocket.service';

export type NotificationType = 
  | 'recipe_like'
  | 'recipe_comment'
  | 'list_share'
  | 'price_alert'
  | 'new_follower'
  | 'mention';

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

export type NotificationStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface Notification {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  channels: NotificationChannel[];
  status: Partial<Record<NotificationChannel, NotificationStatus>>;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NotificationPreferences {
  _id: ObjectId;
  userId: ObjectId;
  channels: {
    [K in NotificationType]: NotificationChannel[];
  };
  emailFrequency: 'instant' | 'daily' | 'weekly' | 'never';
  pushEnabled: boolean;
  smsEnabled: boolean;
  doNotDisturb: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

class NotificationService {
  private static instance: NotificationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/notifications`;
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  // Get notifications
  async getNotifications(options: {
    unreadOnly?: boolean;
    types?: NotificationType[];
    channels?: NotificationChannel[];
    limit?: number;
    before?: Date;
    after?: Date;
  } = {}): Promise<Notification[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, String(value));
        }
      }
    });

    return this.request<Notification[]>(`?${params.toString()}`);
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/${notificationId}/read`, {
      method: 'POST',
    });
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    await this.request('/read-all', {
      method: 'POST',
    });
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Get notification preferences
  async getPreferences(): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/preferences');
  }

  // Update notification preferences
  async updatePreferences(
    preferences: Partial<Omit<NotificationPreferences, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // Subscribe to real-time notifications
  subscribeToNotifications(callback: (notification: Notification) => void): () => void {
    return wsService.subscribe('notification', callback);
  }

  // Register push notification token
  async registerPushToken(token: string, platform: 'web' | 'ios' | 'android'): Promise<void> {
    await this.request('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  // Unregister push notification token
  async unregisterPushToken(token: string): Promise<void> {
    await this.request('/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService; 
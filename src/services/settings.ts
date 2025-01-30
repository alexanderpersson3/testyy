import { Collection, ObjectId } from 'mongodb';

export interface UserSettings {
  _id?: ObjectId;
  userId: ObjectId;
  shoppingList: {
    checkedItemsAtBottom: boolean;
    sortCheckedAlphabetically: boolean;
    enableReminders: boolean;
    sortFavoritesAlphabetically: boolean;
    enableSharedLists: boolean;
  };
  notifications: {
    email: boolean;
    push: boolean;
    sharedListUpdates: boolean;
    newFollowers: boolean;
    newComments: boolean;
    weeklyDigest: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class SettingsService {
  constructor(private settingsCollection: Collection<UserSettings>) {}

  async getSettings(userId: ObjectId): Promise<UserSettings> {
    const settings = await this.settingsCollection.findOne({ userId });

    if (!settings) {
      // Return default settings
      return {
        userId,
        shoppingList: {
          checkedItemsAtBottom: true,
          sortCheckedAlphabetically: false,
          enableReminders: false,
          sortFavoritesAlphabetically: true,
          enableSharedLists: true
        },
        notifications: {
          email: true,
          push: true,
          sharedListUpdates: true,
          newFollowers: true,
          newComments: true,
          weeklyDigest: true
        },
        display: {
          theme: 'system',
          language: 'en',
          timezone: 'UTC'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return settings;
  }

  async updateSettings(userId: ObjectId, updates: Partial<UserSettings>): Promise<void> {
    const { _id, userId: _, createdAt, updatedAt, ...validUpdates } = updates;

    await this.settingsCollection.updateOne(
      { userId },
      {
        $set: {
          ...validUpdates,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async updateShoppingListSettings(
    userId: ObjectId,
    updates: Partial<UserSettings['shoppingList']>
  ): Promise<void> {
    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`shoppingList.${key}`] = value;
    }

    await this.settingsCollection.updateOne(
      { userId },
      {
        $set: {
          ...updateFields,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async updateNotificationSettings(
    userId: ObjectId,
    updates: Partial<UserSettings['notifications']>
  ): Promise<void> {
    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`notifications.${key}`] = value;
    }

    await this.settingsCollection.updateOne(
      { userId },
      {
        $set: {
          ...updateFields,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async updateDisplaySettings(
    userId: ObjectId,
    updates: Partial<UserSettings['display']>
  ): Promise<void> {
    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`display.${key}`] = value;
    }

    await this.settingsCollection.updateOne(
      { userId },
      {
        $set: {
          ...updateFields,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }
} 
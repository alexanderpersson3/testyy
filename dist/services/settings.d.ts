import type { Collection } from 'mongodb';
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
export declare class SettingsService {
    private settingsCollection;
    constructor(settingsCollection: Collection<UserSettings>);
    getSettings(userId: ObjectId): Promise<UserSettings>;
    updateSettings(userId: ObjectId, updates: Partial<UserSettings>): Promise<void>;
    updateShoppingListSettings(userId: ObjectId, updates: Partial<UserSettings['shoppingList']>): Promise<void>;
    updateNotificationSettings(userId: ObjectId, updates: Partial<UserSettings['notifications']>): Promise<void>;
    updateDisplaySettings(userId: ObjectId, updates: Partial<UserSettings['display']>): Promise<void>;
}

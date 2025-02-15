export class SettingsService {
    constructor(settingsCollection) {
        this.settingsCollection = settingsCollection;
    }
    async getSettings(userId) {
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
                    enableSharedLists: true,
                },
                notifications: {
                    email: true,
                    push: true,
                    sharedListUpdates: true,
                    newFollowers: true,
                    newComments: true,
                    weeklyDigest: true,
                },
                display: {
                    theme: 'system',
                    language: 'en',
                    timezone: 'UTC',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }
        return settings;
    }
    async updateSettings(userId, updates) {
        const { _id, userId: _, createdAt, updatedAt, ...validUpdates } = updates;
        await this.settingsCollection.updateOne({ userId }, {
            $set: {
                ...validUpdates,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                userId,
                createdAt: new Date(),
            },
        }, { upsert: true });
    }
    async updateShoppingListSettings(userId, updates) {
        const updateFields = {};
        for (const [key, value] of Object.entries(updates)) {
            updateFields[`shoppingList.${key}`] = value;
        }
        await this.settingsCollection.updateOne({ userId }, {
            $set: {
                ...updateFields,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                userId,
                createdAt: new Date(),
            },
        }, { upsert: true });
    }
    async updateNotificationSettings(userId, updates) {
        const updateFields = {};
        for (const [key, value] of Object.entries(updates)) {
            updateFields[`notifications.${key}`] = value;
        }
        await this.settingsCollection.updateOne({ userId }, {
            $set: {
                ...updateFields,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                userId,
                createdAt: new Date(),
            },
        }, { upsert: true });
    }
    async updateDisplaySettings(userId, updates) {
        const updateFields = {};
        for (const [key, value] of Object.entries(updates)) {
            updateFields[`display.${key}`] = value;
        }
        await this.settingsCollection.updateOne({ userId }, {
            $set: {
                ...updateFields,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                userId,
                createdAt: new Date(),
            },
        }, { upsert: true });
    }
}
//# sourceMappingURL=settings.js.map
import { connectToDatabase } from '../db/database.service.js';
import { UserProfile, UserRole, AuthUser } from '../types/user.js';
export class UserManager {
    constructor() {
        this.initializeCollection();
    }
    async initializeCollection() {
        const db = await connectToDatabase();
        this.collection = db.collection('users');
    }
    async getUserById(userId) {
        try {
            const user = await this.collection.findOne({
                _id: new ObjectId(userId),
            });
            return user;
        }
        catch (error) {
            throw new Error(`Failed to get user: ${error}`);
        }
    }
    async createUser(userData) {
        try {
            const now = new Date();
            const result = await this.collection.insertOne({
                ...userData,
                createdAt: now,
                updatedAt: now,
            });
            return {
                ...userData,
                _id: result.insertedId,
                createdAt: now,
                updatedAt: now,
            };
        }
        catch (error) {
            throw new Error(`Failed to create user: ${error}`);
        }
    }
    async updateUser(userId, updates) {
        try {
            const result = await this.collection.updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    ...updates,
                    updatedAt: new Date(),
                },
            });
            if (result.matchedCount === 0) {
                throw new Error('User not found');
            }
        }
        catch (error) {
            throw new Error(`Failed to update user: ${error}`);
        }
    }
    async isAdmin(userId) {
        try {
            const user = await this.getUserById(userId);
            return user?.role === UserRole.ADMIN;
        }
        catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }
    async updateUserRole(userId, role) {
        try {
            const result = await this.collection.updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    role,
                    updatedAt: new Date(),
                },
            });
            return result.modifiedCount > 0;
        }
        catch (error) {
            console.error('Error updating user role:', error);
            return false;
        }
    }
    async getAuthUser(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                return null;
            }
            return {
                _id: user._id,
                id: user._id.toString(),
                email: user.email,
                name: user.name || user.email.split('@')[0],
                role: user.role
            };
        }
        catch (error) {
            console.error('Error getting auth user:', error);
            return null;
        }
    }
    createAuthUser(id, user) {
        return {
            _id: new ObjectId(id),
            id: id,
            email: user.email,
            name: user.name || user.email.split('@')[0], // Use email prefix if name not provided
            role: user.role
        };
    }
}
export const userManager = new UserManager();
//# sourceMappingURL=user-manager.js.map
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { UserRole } from '../types/user';
class UserManager {
    constructor() { }
    static getInstance() {
        if (!UserManager.instance) {
            UserManager.instance = new UserManager();
        }
        return UserManager.instance;
    }
    async getUserById(userId) {
        try {
            const db = await getDb();
            return await db.collection('users').findOne({
                _id: new ObjectId(userId)
            });
        }
        catch (error) {
            console.error('Error getting user:', error);
            return null;
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
    async createUser(email) {
        try {
            const db = await getDb();
            const user = {
                email,
                role: UserRole.USER,
                features: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await db.collection('users').insertOne(user);
            return result.insertedId.toString();
        }
        catch (error) {
            console.error('Error creating user:', error);
            return null;
        }
    }
    async updateUserRole(userId, role) {
        try {
            const db = await getDb();
            const result = await db.collection('users').updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    role,
                    updatedAt: new Date()
                }
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
                id: user._id.toString(),
                email: user.email,
                role: user.role
            };
        }
        catch (error) {
            console.error('Error getting auth user:', error);
            return null;
        }
    }
}
export default UserManager.getInstance();
//# sourceMappingURL=user-manager.js.map
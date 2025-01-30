import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { UserProfile, UserRole, AuthUser } from '../types/user';

class UserManager {
  private static instance: UserManager;

  private constructor() {}

  public static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  public async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const db = await getDb();
      return await db.collection<UserProfile>('users').findOne({
        _id: new ObjectId(userId)
      });
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  public async isAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user?.role === UserRole.ADMIN;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  public async createUser(email: string): Promise<string | null> {
    try {
      const db = await getDb();
      const user: Omit<UserProfile, '_id'> = {
        email,
        role: UserRole.USER,
        features: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<UserProfile>('users').insertOne(user as UserProfile);
      return result.insertedId.toString();
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  public async updateUserRole(userId: string, role: UserRole): Promise<boolean> {
    try {
      const db = await getDb();
      const result = await db.collection<UserProfile>('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            role,
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }

  public async getAuthUser(userId: string): Promise<AuthUser | null> {
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
    } catch (error) {
      console.error('Error getting auth user:', error);
      return null;
    }
  }
}

export default UserManager.getInstance(); 
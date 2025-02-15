import { connectToDatabase } from '../db.js';
import { User, UserInput } from '../types/user.js';
import { generateToken } from '../utils/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { UserRole } from '../types/auth.js';
export class AuthService {
    constructor() { }
    static getInstance() {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }
    async createUser(email, password, name) {
        const db = await connectToDatabase();
        // Check if user already exists
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }
        // Hash password
        const hashedPassword = await hashPassword(password);
        // Create user
        const userId = new ObjectId();
        const user = {
            _id: userId,
            id: userId.toString(),
            email,
            name,
            password: hashedPassword,
            role: UserRole.USER,
            preferences: {
                theme: 'light',
                language: 'en',
                notifications: true,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('users').insertOne(user);
        return user;
    }
    async login(email, password) {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        // Generate token
        const token = generateToken({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
        });
        return { token, user };
    }
}
//# sourceMappingURL=auth-service.js.map
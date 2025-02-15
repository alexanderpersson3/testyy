import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
;
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { auth } from '../middleware/auth.js';
import { DatabaseService } from '../db/database.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { validateLogin, validateRegister } from '../middleware/validation.js';
import logger from '../utils/logger.js';
const router = express.Router();
const db = DatabaseService.getInstance();
// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
// Rate limiters
const loginLimiter = rateLimitMiddleware.api();
const registerLimiter = rateLimitMiddleware.api();
// Logout endpoint
router.post('/logout', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await db.getCollection('refreshTokens').deleteMany({
            userId: new ObjectId(req.user.id),
        });
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        logger.error('Error logging out:', error);
        throw new DatabaseError('Error logging out');
    }
}));
// Login endpoint
router.post('/login', loginLimiter, validateLogin, asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await db.getCollection('users').findOne({ email });
    if (!user) {
        throw new ValidationError('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new ValidationError('Invalid credentials');
    }
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: ACCESS_TOKEN_EXPIRY });
    res.json({
        token,
        user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    });
}));
// Register new user
router.post('/register', registerLimiter, validateRegister, asyncHandler(async (req, res) => {
    try {
        const { email, password, name } = req.body;
        // Check if user exists
        const existingUser = await db.getCollection('users').findOne({ email });
        if (existingUser) {
            throw new ValidationError('Email already exists');
        }
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // Create user
        const user = {
            email,
            password: hashedPassword,
            name,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.getCollection('users').insertOne(user);
        const token = jwt.sign({ id: result.insertedId.toString(), role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: ACCESS_TOKEN_EXPIRY });
        res.status(201).json({
            token,
            user: {
                id: result.insertedId,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 11000) {
            throw new ValidationError('Email already exists');
        }
        throw new DatabaseError('Failed to register user');
    }
}));
export default router;
//# sourceMappingURL=auth.js.map
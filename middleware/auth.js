import jwt from 'jsonwebtoken';
import { getDb } from '../db';
import { ObjectId } from 'mongodb';

// Properly structured auth middleware
exports.authenticateToken = async (req, res, next) => {
    try {
      const token = req.get('Authorization')?.replace('Bearer ', '');

      if (!token) {
        throw new Error('Authorization token missing');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const db = getDb();
      const user = await db.collection('users').findOne({ 
        _id: new ObjectId(decoded.userId) 
      });

      if (!user) {
        throw new Error('User not found');
      }

      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token'
      });
    }
};

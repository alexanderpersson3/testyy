import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
;
export const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined');
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const objectId = new ObjectId(payload.id);
        // Cast to AuthUser to match the extended Express.Request interface
        req.user = {
            _id: objectId,
            id: objectId.toString(),
            email: payload.email,
            name: payload.name,
            role: payload.role,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};
//# sourceMappingURL=require-auth.js.map
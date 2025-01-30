import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
export function generateToken(user) {
    return jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
    }, process.env.JWT_SECRET, { expiresIn: '24h' });
}
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    }
    catch (error) {
        throw new Error('Invalid token');
    }
}
export function convertToObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
export function convertToString(id) {
    return typeof id === 'string' ? id : id.toString();
}
//# sourceMappingURL=auth.js.map
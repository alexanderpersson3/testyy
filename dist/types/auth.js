import { ObjectId } from 'mongodb';
export function convertToObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
export function convertToString(id) {
    return typeof id === 'string' ? id : id.toString();
}
//# sourceMappingURL=auth.js.map
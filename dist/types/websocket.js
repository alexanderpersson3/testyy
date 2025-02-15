import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ObjectId } from 'mongodb';
;
import { UserRole } from '../auth.js';
/**
 * Type guard for WebSocket messages
 */
export function isWebSocketMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        typeof message.type === 'string' &&
        typeof message.timestamp === 'number');
}
/**
 * Type guard for specific message types
 */
export function isAuthMessage(message) {
    return message.type === 'auth' || message.type === 'auth_success';
}
export function isSubscriptionMessage(message) {
    return (message.type === 'subscribe' ||
        message.type === 'subscribed' ||
        message.type === 'unsubscribe' ||
        message.type === 'unsubscribed');
}
export function isDataMessage(message) {
    return message.type === 'message';
}
export function isErrorMessage(message) {
    return message.type === 'error';
}
//# sourceMappingURL=websocket.js.map
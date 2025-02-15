import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
;
/**
 * Generate test user data
 */
function generateTestUser() {
    return {
        _id: new ObjectId(),
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
    };
}
/**
 * Authenticate user and set context variables
 */
export function authenticate(context, events, done) {
    try {
        const user = generateTestUser();
        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
        // Set context variables
        context.vars.userId = user._id.toString();
        context.vars.token = token;
        context.vars.recipeId = new ObjectId().toString();
        done();
    }
    catch (error) {
        console.error('Authentication error:', error);
        done();
    }
}
/**
 * Simulate user activity in a recipe collaboration session
 */
export function simulateUserActivity(context, events, done) {
    try {
        const activities = [
            // Typing indicator
            {
                type: 'typing',
                payload: {
                    recipeId: context.vars.recipeId,
                    userId: context.vars.userId,
                    isTyping: true,
                },
            },
            // Recipe update
            {
                type: 'update',
                payload: {
                    recipeId: context.vars.recipeId,
                    userId: context.vars.userId,
                    changes: {
                        title: `Updated Recipe ${Date.now()}`,
                        servings: Math.floor(Math.random() * 8) + 1,
                    },
                },
            },
            // Comment
            {
                type: 'comment',
                payload: {
                    recipeId: context.vars.recipeId,
                    userId: context.vars.userId,
                    text: `Test comment ${Date.now()}`,
                },
            },
            // Timer start
            {
                type: 'timer',
                payload: {
                    recipeId: context.vars.recipeId,
                    userId: context.vars.userId,
                    duration: Math.floor(Math.random() * 3600),
                    label: 'Test Timer',
                },
            },
        ];
        // Randomly select an activity
        const activity = activities[Math.floor(Math.random() * activities.length)];
        events.emit('send', activity);
        done();
    }
    catch (error) {
        console.error('Activity simulation error:', error);
        done();
    }
}
/**
 * Handle WebSocket errors
 */
export function handleError(error) {
    console.error('WebSocket error:', error);
}
/**
 * Clean up resources
 */
export function cleanup(context, events, done) {
    try {
        events.emit('send', {
            type: 'disconnect',
            payload: {
                userId: context.vars.userId,
            },
        });
        done();
    }
    catch (error) {
        console.error('Cleanup error:', error);
        done();
    }
}
//# sourceMappingURL=websocket.processor.js.map
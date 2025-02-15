interface Context {
    vars: {
        userId: string;
        recipeId: string;
        token: string;
    };
}
/**
 * Authenticate user and set context variables
 */
export declare function authenticate(context: Context, events: any, done: () => void): void;
/**
 * Simulate user activity in a recipe collaboration session
 */
export declare function simulateUserActivity(context: Context, events: any, done: () => void): void;
/**
 * Handle WebSocket errors
 */
export declare function handleError(error: Error): void;
/**
 * Clean up resources
 */
export declare function cleanup(context: Context, events: any, done: () => void): void;
export {};

import { User } from '../types/user.js';
export declare class AuthService {
    private static instance;
    private constructor();
    static getInstance(): AuthService;
    createUser(email: string, password: string, name: string): Promise<User>;
    login(email: string, password: string): Promise<{
        token: string;
        user: User;
    }>;
}

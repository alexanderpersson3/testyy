import { wsService } from './websocket.service';
import { ObjectId } from 'mongodb';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  role: 'user' | 'admin';
  preferences?: {
    theme: 'light' | 'dark';
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  stats?: {
    recipesCount: number;
    savedRecipes: number;
    totalLikes: number;
    averageRating: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface TokenPayload {
  exp: number;
  id: string;
}

class AuthService {
  private static instance: AuthService;
  private baseUrl: string;
  private tokenKey = 'token';
  private userKey = 'user';
  private token: string | null = null;
  private deviceId: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/auth`;
    // Load token from storage if it exists and is valid
    const storedToken = localStorage.getItem(this.tokenKey);
    this.deviceId = localStorage.getItem('deviceId') || this.generateDeviceId();
    
    if (storedToken && this.isValidJWT(storedToken)) {
      console.log('AuthService initialized with valid stored token');
      this.token = storedToken;
    } else {
      console.log('AuthService initialized without valid token');
      this.token = null;
      localStorage.removeItem(this.tokenKey);
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private generateDeviceId(): string {
    const deviceId = `web-${Math.random().toString(36).substring(2)}`;
    localStorage.setItem('deviceId', deviceId);
    return deviceId;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getDeviceId(): string {
    return this.deviceId!;
  }

  private parseJwt(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.parseJwt(token);
    if (!payload) return true;
    
    // Add 30 second buffer for clock skew
    const bufferTime = 30;
    return (payload.exp * 1000) < (Date.now() + bufferTime * 1000);
  }

  public async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/refresh-token`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ deviceId: this.deviceId })
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const { token } = await response.json();
        this.setToken(token);
        return token;
      } catch (error) {
        console.error('Error refreshing token:', error);
        this.clearToken();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async ensureValidToken(): Promise<string | null> {
    if (!this.token) {
      return null;
    }

    if (this.isTokenExpired(this.token)) {
      return this.refreshToken();
    }

    return this.token;
  }

  public setToken(token: string): void {
    if (!token || token.trim() === '') {
      console.error('Cannot set empty token');
      return;
    }

    const trimmedToken = token.trim();
    if (!this.isValidJWT(trimmedToken)) {
      console.error('Invalid token format');
      this.clearToken();
      return;
    }

    try {
      this.token = trimmedToken;
      localStorage.setItem(this.tokenKey, trimmedToken);
      console.log('Token set successfully');
      this.connectWebSocket();
    } catch (error) {
      console.error('Error setting token:', error);
      this.clearToken();
    }
  }

  private isValidJWT(token: string): boolean {
    if (!token) return false;
    
    try {
      // Basic JWT format validation (three parts separated by dots)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Check if each part is base64 encoded
      return parts.every(part => {
        try {
          return btoa(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) === 
                 part.replace(/-/g, '+').replace(/_/g, '/');
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.error('JWT validation error:', error);
      return false;
    }
  }

  public clearToken(): void {
    console.log('Clearing token');
    this.token = null;
    localStorage.removeItem(this.tokenKey);
    wsService.disconnect();
  }

  public isAuthenticated(): boolean {
    return !!this.token;
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.token) {
      console.log('No token available for WebSocket connection');
      return;
    }

    const validToken = await this.ensureValidToken();
    if (!validToken) {
      console.error('Failed to get valid token for WebSocket connection');
      return;
    }

    console.log('Connecting WebSocket with valid token');
    wsService.connect(validToken, this.deviceId!);
  }

  // Initialize connection if token exists
  public initialize(): void {
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken && this.isValidJWT(storedToken)) {
      console.log('Initializing with stored token');
      this.token = storedToken;
      this.connectWebSocket();
    } else {
      if (storedToken) {
        console.log('Stored token is invalid, clearing');
        this.clearToken();
      } else {
        console.log('No stored token found during initialization');
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Authentication failed');
    }

    return response.json();
  }

  public async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(response.token);
    this.setUser(response.user);

    return response;
  }

  public async register(data: RegisterData): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    this.setToken(response.token);
    this.setUser(response.user);

    return response;
  }

  public async socialLogin(provider: 'google' | 'facebook' | 'apple'): Promise<LoginResponse> {
    // This would typically open a popup window for OAuth flow
    const response = await this.request<LoginResponse>(`/social/${provider}`);
    
    this.setToken(response.token);
    this.setUser(response.user);

    return response;
  }

  public async forgotPassword(email: string): Promise<void> {
    await this.request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(token: string, password: string): Promise<void> {
    await this.request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  public async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.request<{ user: User }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    this.setUser(response.user);
    return response.user;
  }

  public async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.request('/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  public async verifyEmail(token: string): Promise<void> {
    await this.request(`/verify-email/${token}`);
  }

  public logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    // Additional cleanup if needed
  }

  public getUser(): User | null {
    const userStr = localStorage.getItem(this.userKey);
    if (!userStr) return null;

    try {
      const user = JSON.parse(userStr);
      return {
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      };
    } catch {
      return null;
    }
  }

  private setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  public async getUserProfile(userId: string): Promise<User> {
    return this.request<User>(`/users/${userId}`);
  }
}

export const authService = AuthService.getInstance();
export default authService; 
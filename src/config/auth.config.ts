/**
 * Authentication configuration
 */
export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  password: {
    saltRounds: number;
    minLength: number;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  session: {
    name: string;
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      maxAge: number;
    };
  };
  rateLimiting: {
    windowMs: number;
    maxAttempts: number;
  };
}

export const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  password: {
    saltRounds: 10,
    minLength: 8,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  session: {
    name: 'rezepta.sid',
    secret: process.env.SESSION_SECRET || 'session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
  },
}; 
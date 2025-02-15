interface JWTConfig {
  secret: string;
  refreshSecret: string;
}

interface Config {
  jwt: JWTConfig;
}

export const config: Config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
  }
}; 
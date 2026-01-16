
export const getEnvironmentConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction,
    isDevelopment,

    // Server
    port: parseInt(process.env.PORT || '3002', 10),

    // Security
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // Redis
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },

    // Logging
    logLevel: isProduction ? 'warn' : 'debug',

    // Rate Limiting
    rateLimit: {
      ttl: 60000,
      limit: isProduction ? 100 : 1000, // Stricter in production
    },

    // Upload
    upload: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      retentionDays: isProduction ? 30 : 7, // Shorter retention in dev
    },
  };
};

export const ENV = getEnvironmentConfig();
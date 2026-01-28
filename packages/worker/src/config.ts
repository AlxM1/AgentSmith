// Worker Configuration

export const config = {
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'agentsmith',
    username: process.env.DB_USERNAME || 'agentsmith',
    password: process.env.DB_PASSWORD || 'password',
  },

  // Worker
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '5000', 10),
  },

  // Execution
  execution: {
    timeout: parseInt(process.env.EXECUTION_TIMEOUT || '3600000', 10), // 1 hour
    maxDataSize: parseInt(process.env.MAX_DATA_SIZE || '16777216', 10), // 16MB
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'your-32-char-encryption-key-here',
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

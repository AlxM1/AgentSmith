// Logger configuration using Winston with log rotation support

import winston from 'winston';
import path from 'path';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for development
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${stack || message}${metaStr}`;
  })
);

// JSON format for production
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Build transports array
const transports: winston.transport[] = [
  new winston.transports.Console()
];

// Add file transports in production
if (config.nodeEnv === 'production') {
  const logDir = process.env.LOG_DIR || '/var/log/agentsmith';

  // Error log
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Combined log
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    })
  );
}

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.nodeEnv === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'agentsmith-backend' },
  transports,
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ],
});

// Audit logger for security-sensitive operations
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), json()),
  defaultMeta: { service: 'agentsmith-audit' },
  transports: config.nodeEnv === 'production'
    ? [
        new winston.transports.File({
          filename: path.join(process.env.LOG_DIR || '/var/log/agentsmith', 'audit.log'),
          maxsize: 100 * 1024 * 1024,
          maxFiles: 30
        })
      ]
    : [new winston.transports.Console()]
});

// Helper functions for structured logging
export const logAudit = (
  action: string,
  userId: string | null,
  details: Record<string, unknown> = {}
) => {
  auditLogger.info(action, {
    userId,
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

export const logError = (
  message: string,
  error: Error,
  context: Record<string, unknown> = {}
) => {
  logger.error(message, {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    ...context
  });
};

export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) => {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    userId
  });
};

export const logExecution = (
  executionId: string,
  workflowId: string,
  status: string,
  duration?: number,
  error?: string
) => {
  const logFn = status === 'failed' ? logger.error.bind(logger) : logger.info.bind(logger);
  logFn('Workflow Execution', {
    executionId,
    workflowId,
    status,
    duration: duration ? `${duration}ms` : undefined,
    error
  });
};

// Export convenience methods
export const log = {
  info: (message: string, meta?: object) => logger.info(message, meta),
  error: (message: string, meta?: object) => logger.error(message, meta),
  warn: (message: string, meta?: object) => logger.warn(message, meta),
  debug: (message: string, meta?: object) => logger.debug(message, meta),
};

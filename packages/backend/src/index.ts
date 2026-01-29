// AgentSmith Backend Server

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { queueService } from './services/QueueService.js';

// Import routes
import { authRouter } from './routes/auth.js';
import { workflowRouter } from './routes/workflows.js';
import { executionRouter } from './routes/executions.js';
import { credentialRouter } from './routes/credentials.js';
import { webhookRouter } from './routes/webhooks.js';
import { userRouter } from './routes/users.js';
import { nodeRouter } from './routes/nodes.js';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin.js';
import { ssoRouter } from './routes/sso.js';
import { twoFactorRouter } from './routes/twoFactor.js';
import cookieParser from 'cookie-parser';

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Health check (no auth required)
app.use('/health', healthRouter);

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth/sso', ssoRouter);
app.use('/api/v1/auth/2fa', twoFactorRouter);
app.use('/api/v1/workflows', workflowRouter);
app.use('/api/v1/executions', executionRouter);
app.use('/api/v1/credentials', credentialRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/nodes', nodeRouter);

// Admin API routes
app.use('/api/admin', adminRouter);

// Webhook routes (separate path)
app.use('/webhooks', webhookRouter);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;
const HOST = config.host;

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize queue service
    await queueService.initialize();
    logger.info('Queue service initialized');

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`AgentSmith Backend running at http://${HOST}:${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Shutdown queue service
      await queueService.shutdown();
      logger.info('Queue service shut down');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export { app };

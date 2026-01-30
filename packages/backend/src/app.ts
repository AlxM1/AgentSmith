// AgentSmith Express App Factory
// Used for testing and modular initialization

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

// Import routes
import { authRouter } from './routes/auth.js';
import { workflowRouter } from './routes/workflows.js';
import { executionRouter } from './routes/executions.js';
import { credentialRouter } from './routes/credentials.js';
import { webhookRouter } from './routes/webhooks.js';
import { userRouter } from './routes/users.js';
import { nodeRouter } from './routes/nodes.js';
import { healthRouter } from './routes/health.js';

/**
 * Create and configure Express app instance
 * Used for testing and production
 */
export async function createApp(): Promise<Express> {
  const app = express();

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for testing
  }));

  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  // Rate limiting (disabled for tests)
  if (config.nodeEnv !== 'test') {
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api/', limiter);
  }

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // Health check (no auth required)
  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);

  // API routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/auth', authRouter); // Alias for tests
  app.use('/api/v1/workflows', workflowRouter);
  app.use('/api/workflows', workflowRouter); // Alias for tests
  app.use('/api/v1/executions', executionRouter);
  app.use('/api/executions', executionRouter); // Alias for tests
  app.use('/api/v1/credentials', credentialRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/nodes', nodeRouter);

  // Webhook routes
  app.use('/webhooks', webhookRouter);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;

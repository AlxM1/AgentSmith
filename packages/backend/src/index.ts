// AgentSmith Backend Server

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { userRateLimiter } from './middleware/userRateLimiter.js';
import { soc2AuditMiddleware } from './middleware/soc2Compliance.js';

// Import services
import { queueService } from './services/QueueService.js';
import { webSocketService } from './services/WebSocketService.js';
import { rbacService } from './services/RBACService.js';
import { haService } from './services/HAService.js';
import { workflowFolderService } from './services/WorkflowFolderService.js';

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
import { docsRouter } from './routes/docs.js';
import { metricsRouter } from './routes/metrics.js';
import { environmentsRouter } from './routes/environments.js';
import { importExportRouter } from './routes/importExport.js';
import { workflowSharingRouter } from './routes/workflowSharing.js';

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
// Handle malformed JSON with 400 instead of 500
app.use((err: any, req: any, res: any, next: any) => {
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && (err as any).status === 400)) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});
app.use(cookieParser());

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Health check (no auth required) - both paths for compatibility
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// API Documentation (Swagger UI)
app.use('/api/docs', docsRouter);

// SOC 2 Compliance audit logging (before routes)
app.use(soc2AuditMiddleware({ enabled: config.nodeEnv === 'production' }));

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth/sso', ssoRouter);
app.use('/api/v1/auth/2fa', twoFactorRouter);
app.use('/api/v1/workflows', workflowRouter);
app.use('/api/v1/workflows/sharing', workflowSharingRouter);
app.use('/api/v1/executions', executionRouter);
app.use('/api/v1/credentials', credentialRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/nodes', nodeRouter);
app.use('/api/v1/environments', environmentsRouter);
app.use('/api/v1/import-export', importExportRouter);

// Metrics endpoint (Prometheus)
app.use('/api/metrics', metricsRouter);
app.use('/metrics', metricsRouter);

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

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize RBAC service
    await rbacService.initialize();
    logger.info('RBAC service initialized');

    // Initialize queue service
    await queueService.initialize();
    logger.info('Queue service initialized');

    // Initialize WebSocket service
    webSocketService.initialize(httpServer);
    logger.info('WebSocket service initialized');

    // Initialize workflow folder service
    await workflowFolderService.initialize();
    logger.info('Workflow folder service initialized');

    // Initialize HA service if enabled
    if (config.ha?.enabled) {
      await haService.initialize({
        enabled: true,
        leaderKey: 'agentsmith:leader',
        leaderTtlMs: 30000,
        heartbeatIntervalMs: 10000,
        electionTimeoutMs: 5000,
        redis: {
          host: config.redis?.host || 'localhost',
          port: config.redis?.port || 6379,
          password: config.redis?.password,
        },
      });
      logger.info('HA service initialized', {
        instanceId: haService.getInstanceId(),
        isLeader: haService.isCurrentLeader(),
      });
    }

    // Start HTTP server
    httpServer.listen(PORT, HOST, () => {
      logger.info(`AgentSmith Backend running at http://${HOST}:${PORT}`);
      logger.info(`WebSocket available at ws://${HOST}:${PORT}/ws`);
      logger.info(`API Documentation at http://${HOST}:${PORT}/api/docs`);
      logger.info(`Metrics at http://${HOST}:${PORT}/metrics`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      // Shutdown HA service first (step down as leader)
      if (config.ha?.enabled) {
        await haService.shutdown();
        logger.info('HA service shut down');
      }

      // Shutdown WebSocket service
      webSocketService.shutdown();
      logger.info('WebSocket service shut down');

      // Close HTTP server
      httpServer.close(() => {
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

export { app, httpServer, webSocketService };

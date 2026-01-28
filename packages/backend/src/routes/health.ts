// Health Check Routes

import { Router } from 'express';
import { checkDatabaseConnection } from '../db/index.js';
import { APP_VERSION } from '@agentsmith/shared';

const router = Router();

router.get('/', async (_req, res) => {
  const dbHealthy = await checkDatabaseConnection();

  const health = {
    status: dbHealthy ? 'healthy' : 'degraded',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    services: [
      {
        name: 'database',
        status: dbHealthy ? 'up' : 'down',
      },
      {
        name: 'api',
        status: 'up',
      },
    ],
  };

  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (_req, res) => {
  const dbHealthy = await checkDatabaseConnection();

  if (dbHealthy) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not ready' });
  }
});

router.get('/live', (_req, res) => {
  res.status(200).json({ alive: true });
});

export { router as healthRouter };

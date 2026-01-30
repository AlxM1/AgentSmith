/**
 * Prometheus Metrics Route
 *
 * Exposes /metrics endpoint for Prometheus scraping
 */

import { Router, Request, Response } from 'express';
import { metricsService } from '../services/MetricsService.js';
import { queueService } from '../services/QueueService.js';
import { db } from '../db/index.js';
import { workflows, credentials, users, executions } from '../db/schema.js';
import { eq, sql, count } from 'drizzle-orm';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Update queue metrics
    const queueStats = await queueService.getQueueStats();
    metricsService.setGauge('queue_jobs_waiting', queueStats.waiting, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_active', queueStats.active, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_completed', queueStats.completed, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_failed', queueStats.failed, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_delayed', queueStats.delayed, { queue: 'workflow-execution' });

    // Update workflow counts
    const workflowCounts = await db
      .select({
        status: workflows.status,
        count: count(),
      })
      .from(workflows)
      .groupBy(workflows.status);

    for (const row of workflowCounts) {
      metricsService.setGauge('workflows_total', Number(row.count), { status: row.status });
    }

    // Update user counts
    const userCounts = await db
      .select({
        role: users.role,
        isActive: users.isActive,
        count: count(),
      })
      .from(users)
      .groupBy(users.role, users.isActive);

    for (const row of userCounts) {
      metricsService.setGauge('users_total', Number(row.count), {
        role: row.role,
        status: row.isActive ? 'active' : 'inactive',
      });
    }

    // Update system metrics
    metricsService.updateSystemMetrics();

    // Generate and return Prometheus output
    const output = metricsService.generatePrometheusOutput();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(output);
  } catch (error) {
    logger.error('Failed to generate metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).send('# Error generating metrics\n');
  }
});

/**
 * GET /metrics/json
 * JSON format metrics (for custom dashboards)
 */
router.get('/json', async (req: Request, res: Response) => {
  try {
    // Update metrics first
    const queueStats = await queueService.getQueueStats();
    metricsService.setGauge('queue_jobs_waiting', queueStats.waiting, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_active', queueStats.active, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_completed', queueStats.completed, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_failed', queueStats.failed, { queue: 'workflow-execution' });
    metricsService.setGauge('queue_jobs_delayed', queueStats.delayed, { queue: 'workflow-execution' });
    metricsService.updateSystemMetrics();

    const metrics = metricsService.getMetricsJson();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to generate JSON metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export { router as metricsRouter };

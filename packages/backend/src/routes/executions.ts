// Execution Routes

import { Router } from 'express';
import { db } from '../db/index.js';
import { executions, workflows } from '../db/schema.js';
import { eq, desc, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { paginationSchema } from '@agentsmith/shared';
import type { IExecution, IExecutionListItem, IExecutionStats } from '@agentsmith/shared';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// List executions
const listQuerySchema = paginationSchema.extend({
  workflowId: z.string().optional(),
  status: z.string().optional(), // comma-separated
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
});

router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, perPage, workflowId, status, startedAfter, startedBefore } = req.query as z.infer<typeof listQuerySchema>;

    const offset = (page - 1) * perPage;

    // Build conditions
    const conditions = [];

    if (workflowId) {
      conditions.push(eq(executions.workflowId, workflowId));
    }

    if (status) {
      const statuses = status.split(',') as Array<'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting'>;
      conditions.push(inArray(executions.status, statuses));
    }

    if (startedAfter) {
      conditions.push(gte(executions.startedAt, new Date(startedAfter)));
    }

    if (startedBefore) {
      conditions.push(lte(executions.startedAt, new Date(startedBefore)));
    }

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(executions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get executions
    const results = await db.query.executions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(executions.startedAt)],
      limit: perPage,
      offset,
    });

    const items: IExecutionListItem[] = results.map(e => ({
      id: e.id,
      workflowId: e.workflowId,
      workflowName: e.workflowName,
      status: e.status,
      mode: e.mode,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt || undefined,
      retryOf: e.retryOf || undefined,
      retrySuccessId: e.retrySuccessId || undefined,
    }));

    res.json({
      success: true,
      data: items,
      meta: {
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
          hasNext: page * perPage < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get execution stats
router.get('/stats', async (req, res, next) => {
  try {
    const { workflowId } = req.query;

    const conditions = workflowId ? [eq(executions.workflowId, workflowId as string)] : [];

    const statsResult = await db
      .select({
        status: executions.status,
        count: sql<number>`count(*)`,
      })
      .from(executions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(executions.status);

    const stats: IExecutionStats = {
      total: 0,
      success: 0,
      failed: 0,
      running: 0,
      pending: 0,
      cancelled: 0,
    };

    for (const row of statsResult) {
      const count = Number(row.count);
      stats.total += count;

      switch (row.status) {
        case 'success':
          stats.success = count;
          break;
        case 'failed':
          stats.failed = count;
          break;
        case 'running':
          stats.running = count;
          break;
        case 'pending':
          stats.pending = count;
          break;
        case 'cancelled':
          stats.cancelled = count;
          break;
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get single execution
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await db.query.executions.findFirst({
      where: eq(executions.id, id),
    });

    if (!execution) {
      throw new NotFoundError('Execution not found');
    }

    res.json({
      success: true,
      data: execution as IExecution,
    });
  } catch (error) {
    next(error);
  }
});

// Stop execution
router.post('/:id/stop', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await db.query.executions.findFirst({
      where: eq(executions.id, id),
    });

    if (!execution) {
      throw new NotFoundError('Execution not found');
    }

    if (execution.status !== 'running' && execution.status !== 'waiting') {
      return res.json({
        success: true,
        data: { message: 'Execution is not running' },
      });
    }

    // TODO: Send stop signal to worker

    await db.update(executions)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
      })
      .where(eq(executions.id, id));

    res.json({
      success: true,
      data: { message: 'Execution stopped' },
    });
  } catch (error) {
    next(error);
  }
});

// Retry execution
router.post('/:id/retry', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await db.query.executions.findFirst({
      where: eq(executions.id, id),
    });

    if (!execution) {
      throw new NotFoundError('Execution not found');
    }

    if (execution.status !== 'failed') {
      return res.json({
        success: false,
        error: { message: 'Only failed executions can be retried' },
      });
    }

    // Get workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, execution.workflowId),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // TODO: Queue retry with worker

    res.json({
      success: true,
      data: {
        message: 'Retry queued',
        newExecutionId: `ex_${Date.now()}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete execution
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const execution = await db.query.executions.findFirst({
      where: eq(executions.id, id),
    });

    if (!execution) {
      throw new NotFoundError('Execution not found');
    }

    await db.delete(executions).where(eq(executions.id, id));

    res.json({
      success: true,
      data: { message: 'Execution deleted' },
    });
  } catch (error) {
    next(error);
  }
});

// Bulk delete executions
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids, workflowId, status, startedBefore } = req.body;

    const conditions = [];

    if (ids && Array.isArray(ids)) {
      conditions.push(inArray(executions.id, ids));
    }

    if (workflowId) {
      conditions.push(eq(executions.workflowId, workflowId));
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      conditions.push(inArray(executions.status, statuses));
    }

    if (startedBefore) {
      conditions.push(lte(executions.startedAt, new Date(startedBefore)));
    }

    if (conditions.length === 0) {
      return res.json({
        success: false,
        error: { message: 'No filter criteria provided' },
      });
    }

    const result = await db.delete(executions)
      .where(and(...conditions));

    res.json({
      success: true,
      data: { message: 'Executions deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export { router as executionRouter };

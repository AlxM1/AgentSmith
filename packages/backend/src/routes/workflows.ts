// @ts-nocheck
// Workflow Routes

import { Router } from 'express';
import { db } from '../db/index.js';
import { workflows, scheduledTriggers, webhooks } from '../db/schema.js';
import { eq, desc, like, and, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { queueService, findTriggerNodes } from '../services/QueueService.js';
import { logger } from '../lib/logger.js';
import {
  workflowCreateSchema,
  workflowUpdateSchema,
  paginationSchema,
  generateWorkflowId,
  defaultWorkflowSettings,
} from '@agentsmith/shared';
import type { IWorkflow, IWorkflowListItem, INode } from '@agentsmith/shared';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// List workflows
const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'error']).optional(),
  tags: z.string().optional(), // comma-separated
});

router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, perPage, sortBy, sortOrder, search, status, tags } = req.query as z.infer<typeof listQuerySchema>;

    const offset = (page - 1) * perPage;

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(like(workflows.name, `%${search}%`));
    }

    if (status) {
      conditions.push(eq(workflows.status, status));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflows)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get workflows
    const results = await db.query.workflows.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: sortOrder === 'asc'
        ? [sql`${workflows[sortBy as keyof typeof workflows] || workflows.updatedAt} ASC`]
        : [desc(workflows[sortBy as keyof typeof workflows] || workflows.updatedAt)],
      limit: perPage,
      offset,
    });

    const items: IWorkflowListItem[] = results.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description || undefined,
      status: w.status,
      tags: (w.tags as string[]) || [],
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      nodeCount: Array.isArray(w.nodes) ? w.nodes.length : 0,
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

// Get single workflow
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    res.json({
      success: true,
      data: workflow as IWorkflow,
    });
  } catch (error) {
    next(error);
  }
});

// Create workflow
router.post('/', validateBody(workflowCreateSchema), async (req, res, next) => {
  try {
    const data = req.body;

    const workflowId = generateWorkflowId();
    const now = new Date();

    const newWorkflow = {
      id: workflowId,
      name: data.name,
      description: data.description,
      nodes: data.nodes || [],
      connections: data.connections || [],
      settings: { ...defaultWorkflowSettings, ...data.settings },
      tags: data.tags || [],
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user!.id,
    };

    await db.insert(workflows).values(newWorkflow);

    res.status(201).json({
      success: true,
      data: newWorkflow as IWorkflow,
    });
  } catch (error) {
    next(error);
  }
});

// Update workflow
router.put('/:id', validateBody(workflowUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Check if exists
    const existing = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    // Update
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: req.user!.id,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.nodes !== undefined) updateData.nodes = data.nodes;
    if (data.connections !== undefined) updateData.connections = data.connections;
    if (data.settings !== undefined) {
      updateData.settings = { ...(existing.settings as object), ...data.settings };
    }
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) updateData.status = data.status;

    await db.update(workflows)
      .set(updateData)
      .where(eq(workflows.id, id));

    // Get updated workflow
    const updated = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    res.json({
      success: true,
      data: updated as IWorkflow,
    });
  } catch (error) {
    next(error);
  }
});

// Delete workflow
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if exists
    const existing = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    await db.delete(workflows).where(eq(workflows.id, id));

    res.json({
      success: true,
      data: { message: 'Workflow deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// Activate workflow
router.post('/:id/activate', async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (workflow.status === 'active') {
      throw new BadRequestError('Workflow is already active');
    }

    // Find and register triggers
    const workflowData = workflow as unknown as IWorkflow;
    const triggers = findTriggerNodes(workflowData);
    const registeredTriggers: string[] = [];

    // Register schedule triggers
    for (const node of triggers.scheduleTriggers) {
      const cronExpression = (node.parameters?.cronExpression || node.parameters?.schedule) as string;
      if (cronExpression) {
        try {
          const triggerId = await queueService.registerScheduledTrigger({
            workflowId: id,
            workflow: workflowData,
            nodeId: node.id,
            cronExpression,
            timezone: node.parameters?.timezone as string,
          });
          registeredTriggers.push(triggerId);
          logger.info(`Registered schedule trigger: ${triggerId}`, { workflowId: id });
        } catch (error) {
          logger.error(`Failed to register schedule trigger`, { error, nodeId: node.id });
        }
      }
    }

    // Register webhook triggers
    for (const node of triggers.webhookTriggers) {
      const path = node.parameters?.path as string || `/webhook/${id}/${node.id}`;
      try {
        const webhookId = await queueService.registerWebhook({
          workflowId: id,
          nodeId: node.id,
          path,
          method: node.parameters?.method as string,
        });
        registeredTriggers.push(webhookId);
        logger.info(`Registered webhook: ${webhookId}`, { workflowId: id, path });
      } catch (error) {
        logger.error(`Failed to register webhook`, { error, nodeId: node.id });
      }
    }

    await db.update(workflows)
      .set({ status: 'active', updatedAt: new Date(), updatedBy: req.user!.id })
      .where(eq(workflows.id, id));

    res.json({
      success: true,
      data: {
        message: 'Workflow activated successfully',
        triggersRegistered: registeredTriggers.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Deactivate workflow
router.post('/:id/deactivate', async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    if (workflow.status !== 'active') {
      throw new BadRequestError('Workflow is not active');
    }

    // Unregister all triggers for this workflow
    let unregisteredCount = 0;

    // Deactivate scheduled triggers
    const schedules = await db.query.scheduledTriggers.findMany({
      where: and(
        eq(scheduledTriggers.workflowId, id),
        eq(scheduledTriggers.isActive, true)
      ),
    });

    for (const trigger of schedules) {
      await queueService.unregisterScheduledTrigger(trigger.id);
      unregisteredCount++;
    }

    // Deactivate webhooks
    const workflowWebhooks = await db.query.webhooks.findMany({
      where: and(
        eq(webhooks.workflowId, id),
        eq(webhooks.isActive, true)
      ),
    });

    for (const wh of workflowWebhooks) {
      await queueService.unregisterWebhook(wh.id);
      unregisteredCount++;
    }

    await db.update(workflows)
      .set({ status: 'inactive', updatedAt: new Date(), updatedBy: req.user!.id })
      .where(eq(workflows.id, id));

    logger.info(`Deactivated workflow: ${id}`, { unregisteredTriggers: unregisteredCount });

    res.json({
      success: true,
      data: {
        message: 'Workflow deactivated successfully',
        triggersUnregistered: unregisteredCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Execute workflow manually
router.post('/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inputData } = req.body;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    // Queue workflow execution with the worker
    const { executionId, jobId } = await queueService.queueExecution({
      workflowId: id,
      workflow: workflow as unknown as IWorkflow,
      mode: 'manual',
      inputData,
      userId: req.user!.id,
    });

    logger.info(`Manual execution queued: ${executionId}`, { workflowId: id });

    res.json({
      success: true,
      data: {
        executionId,
        jobId,
        message: 'Workflow execution queued',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate workflow
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    const newWorkflowId = generateWorkflowId();
    const now = new Date();

    const duplicated = {
      id: newWorkflowId,
      name: name || `${workflow.name} (Copy)`,
      description: workflow.description,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      tags: workflow.tags,
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user!.id,
    };

    await db.insert(workflows).values(duplicated);

    res.status(201).json({
      success: true,
      data: duplicated,
    });
  } catch (error) {
    next(error);
  }
});

// Export workflow
router.get('/:id/export', async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    const exported = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      tags: workflow.tags,
    };

    res.json({
      success: true,
      data: exported,
    });
  } catch (error) {
    next(error);
  }
});

// Import workflow
router.post('/import', async (req, res, next) => {
  try {
    const { workflow: importedWorkflow } = req.body;

    if (!importedWorkflow || !importedWorkflow.name) {
      throw new BadRequestError('Invalid workflow data');
    }

    const workflowId = generateWorkflowId();
    const now = new Date();

    const newWorkflow = {
      id: workflowId,
      name: importedWorkflow.name,
      description: importedWorkflow.description,
      nodes: importedWorkflow.nodes || [],
      connections: importedWorkflow.connections || [],
      settings: { ...defaultWorkflowSettings, ...(importedWorkflow.settings || {}) },
      tags: importedWorkflow.tags || [],
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user!.id,
    };

    await db.insert(workflows).values(newWorkflow);

    res.status(201).json({
      success: true,
      data: newWorkflow,
    });
  } catch (error) {
    next(error);
  }
});

export { router as workflowRouter };

// @ts-nocheck
/**
 * Admin API Routes
 * Backend endpoints for the admin panel
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { users, workflows, executions, credentials } from '../db/schema.js';
import { eq, desc, sql, count, and, gte, lte, like, or } from 'drizzle-orm';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { queueService } from '../services/QueueService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import os from 'os';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ============================================================================
// DASHBOARD & STATS
// ============================================================================

/**
 * GET /api/admin/stats/dashboard
 * Get dashboard statistics
 */
router.get('/stats/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user counts
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(users);

    const [activeUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.isActive, true));

    // Get workflow counts
    const [totalWorkflowsResult] = await db
      .select({ count: count() })
      .from(workflows);

    const [activeWorkflowsResult] = await db
      .select({ count: count() })
      .from(workflows)
      .where(eq(workflows.active, true));

    // Get execution counts
    const [totalExecutionsResult] = await db
      .select({ count: count() })
      .from(executions);

    const [executionsTodayResult] = await db
      .select({ count: count() })
      .from(executions)
      .where(gte(executions.startedAt, today));

    // Calculate success rate
    const [successfulResult] = await db
      .select({ count: count() })
      .from(executions)
      .where(eq(executions.status, 'completed'));

    const totalExecutions = totalExecutionsResult?.count || 0;
    const successfulExecutions = successfulResult?.count || 0;
    const successRate = totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 1000) / 10
      : 100;

    // Calculate average execution time (from completed executions)
    const avgTimeResult = await db
      .select({
        avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (finished_at - started_at)))`,
      })
      .from(executions)
      .where(and(
        eq(executions.status, 'completed'),
        sql`finished_at IS NOT NULL`
      ));

    const averageExecutionTime = Math.round((avgTimeResult[0]?.avgTime || 0) * 10) / 10;

    res.json({
      totalUsers: totalUsersResult?.count || 0,
      activeUsers: activeUsersResult?.count || 0,
      totalWorkflows: totalWorkflowsResult?.count || 0,
      activeWorkflows: activeWorkflowsResult?.count || 0,
      totalExecutions,
      executionsToday: executionsTodayResult?.count || 0,
      successRate,
      averageExecutionTime,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats/health
 * Get system health status
 */
router.get('/stats/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get CPU usage
    const cpus = os.cpus();
    const cpuUsage = Math.round(
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length
    );

    // Get memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // Get queue stats
    const queueStats = await queueService.getQueueStats();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (cpuUsage > 90 || memoryUsage > 90) {
      status = 'unhealthy';
    } else if (cpuUsage > 70 || memoryUsage > 70 || queueStats.waiting > 100) {
      status = 'degraded';
    }

    res.json({
      status,
      cpu: cpuUsage,
      memory: memoryUsage,
      storage: 50, // Would need actual disk check
      queueSize: queueStats.waiting,
      activeWorkers: queueStats.active,
      uptime: Math.round(os.uptime()),
      lastCheck: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats/executions/trend
 * Get execution trend over time
 */
router.get('/stats/executions/trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily execution counts grouped by status
    const trends = await db
      .select({
        date: sql<string>`DATE(started_at)`,
        total: count(),
        successful: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      })
      .from(executions)
      .where(gte(executions.startedAt, startDate))
      .groupBy(sql`DATE(started_at)`)
      .orderBy(sql`DATE(started_at)`);

    res.json(trends);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats/nodes/usage
 * Get node usage statistics
 */
router.get('/stats/nodes/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all workflows and count node types
    const workflowData = await db.select().from(workflows);

    const nodeTypeCounts: Record<string, number> = {};
    let totalNodes = 0;

    for (const workflow of workflowData) {
      const nodes = (workflow.nodes as Array<{ type: string }>) || [];
      for (const node of nodes) {
        nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] || 0) + 1;
        totalNodes++;
      }
    }

    // Convert to array and calculate percentages
    const usage = Object.entries(nodeTypeCounts)
      .map(([nodeType, nodeCount]) => ({
        nodeType,
        count: nodeCount,
        percentage: Math.round((nodeCount / totalNodes) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 nodes

    res.json(usage);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/users
 * List all users with pagination
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (search) {
      conditions.push(or(
        like(users.email, `%${search}%`),
        like(users.firstName, `%${search}%`),
        like(users.lastName, `%${search}%`)
      ));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    // Get paginated users
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult?.count || 0;

    res.json({
      data: userList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users/:id
 * Get user by ID
 */
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, req.params.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Create new user
 */
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, password, role } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if email already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role,
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    logger.info('Admin created new user', { userId: newUser.id, email: newUser.email });

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update user
 */
router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, role, isActive } = req.body;

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updatedUser] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('Admin updated user', { userId: updatedUser.id });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id });

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('Admin deleted user', { userId: deletedUser.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password
 */
router.post('/users/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Generate temporary password
    const temporaryPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const [updatedUser] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, email: users.email });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('Admin reset user password', { userId: updatedUser.id });

    res.json({ temporaryPassword });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// WORKFLOW MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/workflows
 * List all workflows with pagination
 */
router.get('/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const active = req.query.active;

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (search) {
      conditions.push(like(workflows.name, `%${search}%`));
    }
    if (active !== undefined) {
      conditions.push(eq(workflows.active, active === 'true'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total
    const [totalResult] = await db
      .select({ count: count() })
      .from(workflows)
      .where(whereClause);

    // Get workflows with user info
    const workflowList = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        active: workflows.active,
        userId: workflows.userId,
        userEmail: users.email,
        nodes: workflows.nodes,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .leftJoin(users, eq(workflows.userId, users.id))
      .where(whereClause)
      .orderBy(desc(workflows.updatedAt))
      .limit(limit)
      .offset(offset);

    // Add node count and execution count
    const workflowsWithCounts = await Promise.all(
      workflowList.map(async (w) => {
        const [execCount] = await db
          .select({ count: count() })
          .from(executions)
          .where(eq(executions.workflowId, w.id));

        const [lastExec] = await db
          .select({ finishedAt: executions.finishedAt })
          .from(executions)
          .where(eq(executions.workflowId, w.id))
          .orderBy(desc(executions.startedAt))
          .limit(1);

        return {
          ...w,
          nodeCount: (w.nodes as unknown[])?.length || 0,
          executionCount: execCount?.count || 0,
          lastExecutedAt: lastExec?.finishedAt || null,
        };
      })
    );

    const total = totalResult?.count || 0;

    res.json({
      data: workflowsWithCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/workflows/:id
 * Get workflow by ID
 */
router.get('/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [workflow] = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        active: workflows.active,
        nodes: workflows.nodes,
        connections: workflows.connections,
        settings: workflows.settings,
        userId: workflows.userId,
        userEmail: users.email,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .leftJoin(users, eq(workflows.userId, users.id))
      .where(eq(workflows.id, req.params.id));

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/workflows/:id/active
 * Toggle workflow active status
 */
router.patch('/workflows/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.body;

    const [workflow] = await db
      .update(workflows)
      .set({ active, updatedAt: new Date() })
      .where(eq(workflows.id, req.params.id))
      .returning();

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    logger.info('Admin toggled workflow active', { workflowId: workflow.id, active });

    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/workflows/:id
 * Delete workflow
 */
router.delete('/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [deleted] = await db
      .delete(workflows)
      .where(eq(workflows.id, req.params.id))
      .returning({ id: workflows.id });

    if (!deleted) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    logger.info('Admin deleted workflow', { workflowId: deleted.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// EXECUTION MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/executions
 * List all executions with pagination
 */
router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const workflowId = req.query.workflowId as string;
    const status = req.query.status as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (workflowId) conditions.push(eq(executions.workflowId, workflowId));
    if (status) conditions.push(eq(executions.status, status));
    if (startDate) conditions.push(gte(executions.startedAt, startDate));
    if (endDate) conditions.push(lte(executions.startedAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total
    const [totalResult] = await db
      .select({ count: count() })
      .from(executions)
      .where(whereClause);

    // Get executions with workflow and user info
    const executionList = await db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        workflowName: workflows.name,
        status: executions.status,
        mode: executions.mode,
        startedAt: executions.startedAt,
        finishedAt: executions.finishedAt,
        error: executions.error,
        userId: workflows.userId,
        userEmail: users.email,
      })
      .from(executions)
      .leftJoin(workflows, eq(executions.workflowId, workflows.id))
      .leftJoin(users, eq(workflows.userId, users.id))
      .where(whereClause)
      .orderBy(desc(executions.startedAt))
      .limit(limit)
      .offset(offset);

    // Add duration
    const executionsWithDuration = executionList.map((e) => ({
      ...e,
      duration: e.finishedAt && e.startedAt
        ? Math.round((new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime()) / 1000)
        : null,
    }));

    const total = totalResult?.count || 0;

    res.json({
      data: executionsWithDuration,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/executions/:id
 * Get execution by ID
 */
router.get('/executions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [execution] = await db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        workflowName: workflows.name,
        status: executions.status,
        mode: executions.mode,
        startedAt: executions.startedAt,
        finishedAt: executions.finishedAt,
        data: executions.data,
        error: executions.error,
        userId: workflows.userId,
        userEmail: users.email,
      })
      .from(executions)
      .leftJoin(workflows, eq(executions.workflowId, workflows.id))
      .leftJoin(users, eq(workflows.userId, users.id))
      .where(eq(executions.id, req.params.id));

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/executions/:id/cancel
 * Cancel execution
 */
router.post('/executions/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cancelled = await queueService.cancelExecution(req.params.id);

    if (!cancelled) {
      return res.status(400).json({ error: 'Could not cancel execution' });
    }

    const [execution] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, req.params.id));

    logger.info('Admin cancelled execution', { executionId: req.params.id });

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/executions/:id/retry
 * Retry execution
 */
router.post('/executions/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await queueService.retryExecution(req.params.id, (req as any).user.id);

    logger.info('Admin retried execution', {
      originalId: req.params.id,
      newId: result.newExecutionId
    });

    res.json({ newExecutionId: result.newExecutionId });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AUDIT LOG
// ============================================================================

// In-memory audit log store (in production, use database table)
const auditLogs: Array<{
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  createdAt: Date;
}> = [];

/**
 * GET /api/admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId as string;
    const action = req.query.action as string;
    const resource = req.query.resource as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    let filtered = [...auditLogs];

    if (userId) filtered = filtered.filter((l) => l.userId === userId);
    if (action) filtered = filtered.filter((l) => l.action === action);
    if (resource) filtered = filtered.filter((l) => l.resource === resource);
    if (startDate) filtered = filtered.filter((l) => l.createdAt >= startDate);
    if (endDate) filtered = filtered.filter((l) => l.createdAt <= endDate);

    // Sort by date descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const data = filtered.slice(offset, offset + limit);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

// Default settings (in production, store in database)
let systemSettings = {
  general: {
    instanceName: 'AgentSmith',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
  },
  execution: {
    defaultTimeout: 300000,
    maxRetries: 3,
    saveExecutionData: true,
    pruneExecutionsAfterDays: 30,
  },
  security: {
    allowSelfRegistration: false,
    enforce2FA: false,
    sessionTimeoutHours: 24,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    ipWhitelist: [] as string[],
    ipBlacklist: [] as string[],
  },
  email: {
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpSecure: true,
    fromEmail: '',
    fromName: 'AgentSmith',
  },
};

/**
 * GET /api/admin/settings
 * Get system settings
 */
router.get('/settings', (req: Request, res: Response) => {
  res.json(systemSettings);
});

/**
 * PATCH /api/admin/settings
 * Update system settings
 */
router.patch('/settings', (req: Request, res: Response) => {
  const updates = req.body;

  // Deep merge settings
  if (updates.general) {
    systemSettings.general = { ...systemSettings.general, ...updates.general };
  }
  if (updates.execution) {
    systemSettings.execution = { ...systemSettings.execution, ...updates.execution };
  }
  if (updates.security) {
    systemSettings.security = { ...systemSettings.security, ...updates.security };
  }
  if (updates.email) {
    systemSettings.email = { ...systemSettings.email, ...updates.email };
  }

  logger.info('Admin updated system settings');

  res.json(systemSettings);
});

/**
 * POST /api/admin/settings/test-email
 * Test email settings
 */
router.post('/settings/test-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!systemSettings.email.enabled) {
      return res.status(400).json({ error: 'Email is not enabled' });
    }

    // In production, actually send test email
    logger.info('Admin tested email settings', { testEmail: email });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CREDENTIALS
// ============================================================================

/**
 * GET /api/admin/credentials/types
 * Get credential types with usage count
 */
router.get('/credentials/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credentialData = await db.select().from(credentials);

    const typeCounts: Record<string, number> = {};
    for (const cred of credentialData) {
      typeCounts[cred.type] = (typeCounts[cred.type] || 0) + 1;
    }

    const types = Object.entries(typeCounts).map(([name, usageCount]) => ({
      name,
      displayName: name.replace(/([A-Z])/g, ' $1').trim(),
      description: `${name} credentials`,
      usageCount,
    }));

    res.json(types);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/credentials/usage
 * Get credential usage across workflows
 */
router.get('/credentials/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credentialData = await db
      .select({
        id: credentials.id,
        name: credentials.name,
        type: credentials.type,
        updatedAt: credentials.updatedAt,
      })
      .from(credentials);

    // Count workflow usage for each credential
    const workflowData = await db.select().from(workflows);
    const credUsage: Record<string, number> = {};

    for (const workflow of workflowData) {
      const nodes = (workflow.nodes as Array<{ credentials?: Record<string, string> }>) || [];
      for (const node of nodes) {
        if (node.credentials) {
          for (const credId of Object.values(node.credentials)) {
            credUsage[credId] = (credUsage[credId] || 0) + 1;
          }
        }
      }
    }

    const usage = credentialData.map((cred) => ({
      credentialId: cred.id,
      credentialName: cred.name,
      type: cred.type,
      workflowCount: credUsage[cred.id] || 0,
      lastUsed: cred.updatedAt,
    }));

    res.json(usage);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AUTH (Admin-specific)
// ============================================================================

/**
 * POST /api/admin/auth/login
 * Admin login (requires admin role)
 */
router.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  // This would be handled by the main auth routes
  // Just redirect to profile for now
  res.redirect('/api/admin/auth/profile');
});

/**
 * GET /api/admin/auth/profile
 * Get current admin profile
 */
router.get('/auth/profile', (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });
});

/**
 * POST /api/admin/auth/logout
 * Admin logout
 */
router.post('/auth/logout', (req: Request, res: Response) => {
  // In production, invalidate the token
  res.json({ success: true });
});

export { router as adminRouter };

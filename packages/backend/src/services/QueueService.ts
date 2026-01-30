// @ts-nocheck
/**
 * Queue Service - BullMQ Integration for Backend
 *
 * Connects the API server to the worker through Redis queues
 */

import { Queue, QueueEvents, Job } from 'bullmq';
import { logger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { executions, scheduledTriggers, webhooks, workflows } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { IWorkflow, ExecutionMode, INode } from '@agentsmith/shared';
import { CronJob } from 'cron';

// Queue connection config
const getConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
});

// Execution status types
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting';

// Job data interface
export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  workflow: IWorkflow;
  mode: ExecutionMode;
  inputData?: Record<string, unknown>;
  userId: string;
  triggeredBy?: string;
}

export interface ScheduledJobData {
  triggerId: string;
  workflowId: string;
  workflow: IWorkflow;
  nodeId: string;
  cronExpression: string;
}

/**
 * Queue Service Singleton
 */
class QueueService {
  private static instance: QueueService;
  private executionQueue: Queue<ExecutionJobData> | null = null;
  private scheduledQueue: Queue<ScheduledJobData> | null = null;
  private queueEvents: QueueEvents | null = null;
  private isInitialized = false;

  // Active cron jobs mapped by trigger ID
  private activeCronJobs: Map<string, CronJob> = new Map();
  // Active webhooks mapped by webhook ID
  private activeWebhooks: Map<string, { workflowId: string; nodeId: string; path: string; method: string }> = new Map();

  private constructor() {}

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Initialize queues and event listeners
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const connection = getConnection();

    try {
      // Create queues
      this.executionQueue = new Queue<ExecutionJobData>('workflow-execution', { connection });
      this.scheduledQueue = new Queue<ScheduledJobData>('scheduled-triggers', { connection });

      // Queue events for monitoring
      this.queueEvents = new QueueEvents('workflow-execution', { connection });

      // Listen for job completion
      this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
        logger.info(`Execution completed: ${jobId}`);
        await this.updateExecutionStatus(jobId, 'success', returnvalue);
      });

      // Listen for job failure
      this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
        logger.error(`Execution failed: ${jobId}`, { error: failedReason });
        await this.updateExecutionStatus(jobId, 'failed', null, failedReason);
      });

      // Listen for job progress
      this.queueEvents.on('progress', async ({ jobId, data }) => {
        logger.debug(`Execution progress: ${jobId}`, { progress: data });
      });

      this.isInitialized = true;
      logger.info('Queue service initialized', { redis: `${connection.host}:${connection.port}` });

      // Load active triggers from database
      await this.loadActiveTriggers();
    } catch (error) {
      logger.error('Failed to initialize queue service', { error });
      throw error;
    }
  }

  /**
   * Load active scheduled triggers and webhooks from database on startup
   */
  private async loadActiveTriggers(): Promise<void> {
    try {
      // Load active scheduled triggers
      const activeScheduledTriggers = await db
        .select({
          trigger: scheduledTriggers,
          workflow: workflows,
        })
        .from(scheduledTriggers)
        .leftJoin(workflows, eq(scheduledTriggers.workflowId, workflows.id))
        .where(and(
          eq(scheduledTriggers.isActive, true),
          eq(workflows.active, true)
        ));

      let scheduledCount = 0;
      for (const { trigger, workflow } of activeScheduledTriggers) {
        if (!workflow) continue;

        try {
          // Create cron job
          const cronJob = new CronJob(
            trigger.cronExpression,
            async () => {
              logger.info(`Scheduled trigger fired: ${trigger.id}`, {
                workflowId: trigger.workflowId,
                cron: trigger.cronExpression,
              });

              // Queue the execution
              await this.queueExecution({
                workflowId: trigger.workflowId,
                workflow: workflow as unknown as IWorkflow,
                mode: 'trigger',
                inputData: {
                  triggeredBy: 'schedule',
                  triggerId: trigger.id,
                  scheduledTime: new Date().toISOString(),
                },
                userId: workflow.createdBy || 'system',
                triggeredBy: `schedule:${trigger.id}`,
              });
            },
            null, // onComplete
            true, // start
            trigger.timezone || 'UTC'
          );

          this.activeCronJobs.set(trigger.id, cronJob);
          scheduledCount++;

          logger.debug(`Loaded scheduled trigger: ${trigger.id}`, {
            cron: trigger.cronExpression,
            timezone: trigger.timezone,
          });
        } catch (error) {
          logger.error(`Failed to load scheduled trigger: ${trigger.id}`, { error });
        }
      }

      // Load active webhooks
      const activeWebhooks = await db
        .select({
          webhook: webhooks,
          workflow: workflows,
        })
        .from(webhooks)
        .leftJoin(workflows, eq(webhooks.workflowId, workflows.id))
        .where(and(
          eq(webhooks.isActive, true),
          eq(workflows.active, true)
        ));

      let webhookCount = 0;
      for (const { webhook, workflow } of activeWebhooks) {
        if (!workflow) continue;

        this.activeWebhooks.set(webhook.id, {
          workflowId: webhook.workflowId,
          nodeId: webhook.nodeId,
          path: webhook.path,
          method: webhook.method || 'POST',
        });
        webhookCount++;

        logger.debug(`Loaded webhook: ${webhook.id}`, {
          path: webhook.path,
          method: webhook.method,
        });
      }

      logger.info(`Loaded active triggers from database`, {
        scheduledTriggers: scheduledCount,
        webhooks: webhookCount,
      });
    } catch (error) {
      logger.error('Failed to load active triggers', { error });
      // Don't throw - allow server to start even if trigger loading fails
    }
  }

  /**
   * Get active webhook by path and method
   */
  getWebhookByPath(path: string, method: string): { webhookId: string; workflowId: string; nodeId: string } | null {
    for (const [webhookId, webhook] of this.activeWebhooks) {
      if (webhook.path === path && webhook.method.toUpperCase() === method.toUpperCase()) {
        return {
          webhookId,
          workflowId: webhook.workflowId,
          nodeId: webhook.nodeId,
        };
      }
    }
    return null;
  }

  /**
   * Check if a webhook path is registered
   */
  isWebhookRegistered(path: string): boolean {
    for (const webhook of this.activeWebhooks.values()) {
      if (webhook.path === path) {
        return true;
      }
    }
    return false;
  }

  /**
   * Queue a workflow execution
   */
  async queueExecution(params: {
    workflowId: string;
    workflow: IWorkflow;
    mode: ExecutionMode;
    inputData?: Record<string, unknown>;
    userId: string;
    triggeredBy?: string;
  }): Promise<{ executionId: string; jobId: string }> {
    if (!this.executionQueue) {
      throw new Error('Queue service not initialized');
    }

    const executionId = `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create execution record in database
    await db.insert(executions).values({
      id: executionId,
      workflowId: params.workflowId,
      workflowName: params.workflow.name,
      status: 'pending',
      mode: params.mode,
      data: { input: params.inputData || {} },
      startedAt: new Date(),
      createdBy: params.userId,
    });

    // Add job to queue
    const job = await this.executionQueue.add(
      `execution-${params.workflowId}`,
      {
        executionId,
        workflowId: params.workflowId,
        workflow: params.workflow,
        mode: params.mode,
        inputData: params.inputData,
        userId: params.userId,
        triggeredBy: params.triggeredBy,
      },
      {
        jobId: executionId,
        attempts: parseInt(process.env.WORKER_MAX_RETRIES || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.WORKER_RETRY_DELAY || '5000'),
        },
        timeout: parseInt(process.env.EXECUTION_TIMEOUT || '3600000'),
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failures for 7 days
        },
      }
    );

    // Update status to running
    await db.update(executions)
      .set({ status: 'running' })
      .where(eq(executions.id, executionId));

    logger.info(`Queued execution: ${executionId}`, {
      workflowId: params.workflowId,
      mode: params.mode,
      jobId: job.id,
    });

    return { executionId, jobId: job.id || executionId };
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    if (!this.executionQueue) {
      throw new Error('Queue service not initialized');
    }

    try {
      // Get the job
      const job = await this.executionQueue.getJob(executionId);

      if (!job) {
        // Job not in queue, just update DB
        await db.update(executions)
          .set({ status: 'cancelled', finishedAt: new Date() })
          .where(eq(executions.id, executionId));
        return true;
      }

      // Check if job is active
      const state = await job.getState();

      if (state === 'active') {
        // Can't cancel active jobs directly, need to signal worker
        // For now, mark as cancelled in DB and let worker check
        await db.update(executions)
          .set({ status: 'cancelled', finishedAt: new Date() })
          .where(eq(executions.id, executionId));

        // Remove from queue if waiting
        await job.remove();
        return true;
      }

      if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        await db.update(executions)
          .set({ status: 'cancelled', finishedAt: new Date() })
          .where(eq(executions.id, executionId));
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to cancel execution: ${executionId}`, { error });
      throw error;
    }
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(executionId: string, userId: string): Promise<{ newExecutionId: string }> {
    // Get original execution
    const original = await db.query.executions.findFirst({
      where: eq(executions.id, executionId),
    });

    if (!original) {
      throw new Error('Execution not found');
    }

    if (original.status !== 'failed') {
      throw new Error('Can only retry failed executions');
    }

    // Get workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(executions.workflowId, original.workflowId),
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Queue new execution
    const result = await this.queueExecution({
      workflowId: original.workflowId,
      workflow: workflow as unknown as IWorkflow,
      mode: 'retry',
      inputData: (original.data as any)?.input,
      userId,
      triggeredBy: executionId,
    });

    // Update original execution with retry info
    await db.update(executions)
      .set({ retrySuccessId: result.executionId })
      .where(eq(executions.id, executionId));

    return { newExecutionId: result.executionId };
  }

  /**
   * Update execution status in database
   */
  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    result?: unknown,
    error?: string
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        finishedAt: new Date(),
      };

      if (result) {
        updateData.data = { result };
      }

      if (error) {
        updateData.error = error;
      }

      await db.update(executions)
        .set(updateData)
        .where(eq(executions.id, executionId));
    } catch (err) {
      logger.error(`Failed to update execution status: ${executionId}`, { error: err });
    }
  }

  /**
   * Get execution job status
   */
  async getJobStatus(executionId: string): Promise<{
    state: string;
    progress: number;
    attemptsMade: number;
    failedReason?: string;
  } | null> {
    if (!this.executionQueue) {
      throw new Error('Queue service not initialized');
    }

    const job = await this.executionQueue.getJob(executionId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress as number;

    return {
      state,
      progress: typeof progress === 'number' ? progress : 0,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  /**
   * Register scheduled trigger
   */
  async registerScheduledTrigger(params: {
    workflowId: string;
    workflow: IWorkflow;
    nodeId: string;
    cronExpression: string;
    timezone?: string;
  }): Promise<string> {
    const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timezone = params.timezone || 'UTC';

    // Save to database
    await db.insert(scheduledTriggers).values({
      id: triggerId,
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      cronExpression: params.cronExpression,
      timezone,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create and start the cron job
    try {
      const cronJob = new CronJob(
        params.cronExpression,
        async () => {
          logger.info(`Scheduled trigger fired: ${triggerId}`, {
            workflowId: params.workflowId,
            cron: params.cronExpression,
          });

          // Get the latest workflow version
          const latestWorkflow = await db.query.workflows.findFirst({
            where: eq(workflows.id, params.workflowId),
          });

          if (!latestWorkflow || !latestWorkflow.active) {
            logger.warn(`Skipping scheduled execution - workflow inactive: ${params.workflowId}`);
            return;
          }

          await this.queueExecution({
            workflowId: params.workflowId,
            workflow: latestWorkflow as unknown as IWorkflow,
            mode: 'trigger',
            inputData: {
              triggeredBy: 'schedule',
              triggerId,
              scheduledTime: new Date().toISOString(),
            },
            userId: latestWorkflow.createdBy || 'system',
            triggeredBy: `schedule:${triggerId}`,
          });
        },
        null,
        true,
        timezone
      );

      this.activeCronJobs.set(triggerId, cronJob);
    } catch (error) {
      logger.error(`Failed to create cron job for trigger: ${triggerId}`, { error });
      throw error;
    }

    logger.info(`Registered scheduled trigger: ${triggerId}`, {
      workflowId: params.workflowId,
      cron: params.cronExpression,
      timezone,
    });

    return triggerId;
  }

  /**
   * Unregister scheduled trigger
   */
  async unregisterScheduledTrigger(triggerId: string): Promise<void> {
    // Stop the cron job if active
    const cronJob = this.activeCronJobs.get(triggerId);
    if (cronJob) {
      cronJob.stop();
      this.activeCronJobs.delete(triggerId);
    }

    // Update database
    await db.update(scheduledTriggers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(scheduledTriggers.id, triggerId));

    logger.info(`Unregistered scheduled trigger: ${triggerId}`);
  }

  /**
   * Register webhook
   */
  async registerWebhook(params: {
    workflowId: string;
    nodeId: string;
    path: string;
    method?: string;
  }): Promise<string> {
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const method = params.method || 'POST';

    // Ensure path starts with /
    const webhookPath = params.path.startsWith('/') ? params.path : `/${params.path}`;

    // Check for duplicate path
    if (this.isWebhookRegistered(webhookPath)) {
      throw new Error(`Webhook path already registered: ${webhookPath}`);
    }

    // Save to database
    await db.insert(webhooks).values({
      id: webhookId,
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      path: webhookPath,
      method,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add to active webhooks map
    this.activeWebhooks.set(webhookId, {
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      path: webhookPath,
      method,
    });

    logger.info(`Registered webhook: ${webhookId}`, {
      workflowId: params.workflowId,
      path: webhookPath,
      method,
    });

    return webhookId;
  }

  /**
   * Unregister webhook
   */
  async unregisterWebhook(webhookId: string): Promise<void> {
    // Remove from active webhooks map
    this.activeWebhooks.delete(webhookId);

    // Update database
    await db.update(webhooks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(webhooks.id, webhookId));

    logger.info(`Unregistered webhook: ${webhookId}`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.executionQueue) {
      throw new Error('Queue service not initialized');
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.executionQueue.getWaitingCount(),
      this.executionQueue.getActiveCount(),
      this.executionQueue.getCompletedCount(),
      this.executionQueue.getFailedCount(),
      this.executionQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clean up old jobs
   */
  async cleanOldJobs(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.executionQueue) return;

    await this.executionQueue.clean(olderThanMs, 1000, 'completed');
    await this.executionQueue.clean(olderThanMs, 1000, 'failed');

    logger.info('Cleaned old jobs from queue');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Stop all cron jobs
    for (const [triggerId, cronJob] of this.activeCronJobs) {
      try {
        cronJob.stop();
        logger.debug(`Stopped cron job: ${triggerId}`);
      } catch (error) {
        logger.error(`Error stopping cron job: ${triggerId}`, { error });
      }
    }
    this.activeCronJobs.clear();
    this.activeWebhooks.clear();

    // Close queue connections
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.executionQueue) {
      await this.executionQueue.close();
    }
    if (this.scheduledQueue) {
      await this.scheduledQueue.close();
    }

    this.isInitialized = false;
    logger.info('Queue service shut down', {
      cronJobsStopped: this.activeCronJobs.size,
      webhooksCleared: this.activeWebhooks.size,
    });
  }

  /**
   * Get active trigger counts for monitoring
   */
  getActiveTriggerCounts(): { scheduledTriggers: number; webhooks: number } {
    return {
      scheduledTriggers: this.activeCronJobs.size,
      webhooks: this.activeWebhooks.size,
    };
  }
}

// Export singleton instance
export const queueService = QueueService.getInstance();

// Export helper to find trigger nodes in a workflow
export function findTriggerNodes(workflow: IWorkflow): {
  scheduleTriggers: INode[];
  webhookTriggers: INode[];
  manualTriggers: INode[];
} {
  const nodes = workflow.nodes || [];

  return {
    scheduleTriggers: nodes.filter(n => n.type === 'scheduleTrigger' || n.type === 'Schedule'),
    webhookTriggers: nodes.filter(n => n.type === 'webhookTrigger' || n.type === 'Webhook'),
    manualTriggers: nodes.filter(n => n.type === 'manualTrigger' || n.type === 'ManualTrigger'),
  };
}

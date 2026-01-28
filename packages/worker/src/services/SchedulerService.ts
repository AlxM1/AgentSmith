// Scheduler Service for Cron-based Triggers

import { Queue } from 'bullmq';
import cron from 'node-cron';
import { logger } from '../lib/logger.js';

interface ScheduledWorkflow {
  id: string;
  workflowId: string;
  cronExpression: string;
  workflow: unknown;
  task?: cron.ScheduledTask;
}

export class SchedulerService {
  private queue: Queue;
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();

  constructor(queue: Queue) {
    this.queue = queue;
  }

  start(): void {
    logger.info('Scheduler service started');
    // In production, load scheduled workflows from database
    this.loadScheduledWorkflows();
  }

  stop(): void {
    logger.info('Stopping scheduler service');
    for (const [id, scheduled] of this.scheduledWorkflows) {
      if (scheduled.task) {
        scheduled.task.stop();
      }
    }
    this.scheduledWorkflows.clear();
  }

  private async loadScheduledWorkflows(): Promise<void> {
    // TODO: Load from database
    logger.debug('Loading scheduled workflows from database');
  }

  registerWorkflow(
    triggerId: string,
    workflowId: string,
    cronExpression: string,
    workflow: unknown
  ): void {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Remove existing if any
    this.unregisterWorkflow(triggerId);

    // Create scheduled task
    const task = cron.schedule(cronExpression, async () => {
      logger.info(`Scheduled trigger fired: ${triggerId}`, {
        workflowId,
        cronExpression,
      });

      try {
        await this.queue.add(
          `scheduled-${triggerId}-${Date.now()}`,
          {
            triggerId,
            workflowId,
            workflow,
          },
          {
            removeOnComplete: 100,
            removeOnFail: 100,
          }
        );
      } catch (error) {
        logger.error(`Failed to queue scheduled trigger: ${triggerId}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.scheduledWorkflows.set(triggerId, {
      id: triggerId,
      workflowId,
      cronExpression,
      workflow,
      task,
    });

    logger.info(`Registered scheduled workflow: ${triggerId}`, {
      workflowId,
      cronExpression,
    });
  }

  unregisterWorkflow(triggerId: string): void {
    const scheduled = this.scheduledWorkflows.get(triggerId);
    if (scheduled) {
      if (scheduled.task) {
        scheduled.task.stop();
      }
      this.scheduledWorkflows.delete(triggerId);
      logger.info(`Unregistered scheduled workflow: ${triggerId}`);
    }
  }

  getScheduledWorkflows(): ScheduledWorkflow[] {
    return Array.from(this.scheduledWorkflows.values());
  }
}

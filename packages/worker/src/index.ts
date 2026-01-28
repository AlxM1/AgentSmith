// AgentSmith Worker - Workflow Execution Engine

import 'dotenv/config';
import { Worker, Queue, QueueEvents } from 'bullmq';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { WorkflowExecutor } from './executor/WorkflowExecutor.js';
import { SchedulerService } from './services/SchedulerService.js';
import type { IWorkflow, ExecutionMode } from '@agentsmith/shared';

// Queue connection
const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};

// Create queues
const executionQueue = new Queue('workflow-execution', { connection });
const scheduledQueue = new Queue('scheduled-triggers', { connection });

// Queue events for monitoring
const queueEvents = new QueueEvents('workflow-execution', { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info(`Job ${jobId} completed`, { result: returnvalue });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed: ${failedReason}`);
});

// Workflow execution worker
const executionWorker = new Worker(
  'workflow-execution',
  async (job) => {
    const { workflowId, workflow, mode, inputData, executionId } = job.data as {
      workflowId: string;
      workflow: IWorkflow;
      mode: ExecutionMode;
      inputData?: Record<string, unknown>;
      executionId: string;
    };

    logger.info(`Processing workflow execution: ${executionId}`, {
      workflowId,
      mode,
    });

    const executor = new WorkflowExecutor(workflow, {
      mode,
      executionId,
    });

    try {
      const result = await executor.execute(inputData);

      logger.info(`Workflow execution completed: ${executionId}`, {
        status: 'success',
      });

      return result;
    } catch (error) {
      logger.error(`Workflow execution failed: ${executionId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: config.worker.concurrency,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

executionWorker.on('error', (err) => {
  logger.error('Worker error:', { error: err.message });
});

// Scheduled trigger worker
const scheduledWorker = new Worker(
  'scheduled-triggers',
  async (job) => {
    const { workflowId, workflow, triggerId } = job.data;

    logger.info(`Processing scheduled trigger: ${triggerId}`, {
      workflowId,
    });

    // Add to execution queue
    await executionQueue.add(
      `execution-${workflowId}-${Date.now()}`,
      {
        workflowId,
        workflow,
        mode: 'trigger',
        executionId: `ex_${Date.now()}`,
      },
      {
        attempts: config.worker.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.worker.retryDelay,
        },
      }
    );
  },
  {
    connection,
    concurrency: 1,
  }
);

// Start scheduler service
const scheduler = new SchedulerService(scheduledQueue);
scheduler.start();

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down worker...');

  scheduler.stop();

  await executionWorker.close();
  await scheduledWorker.close();
  await executionQueue.close();
  await scheduledQueue.close();

  logger.info('Worker shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('AgentSmith Worker started', {
  concurrency: config.worker.concurrency,
  redis: `${config.redis.host}:${config.redis.port}`,
});

// Export for programmatic use
export { executionQueue, scheduledQueue };

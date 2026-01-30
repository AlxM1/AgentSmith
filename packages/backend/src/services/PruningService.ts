// @ts-nocheck
/**
 * Execution Pruning Service
 *
 * Automatically cleans up old execution data to manage database size
 */

import { db } from '../db/index.js';
import { executions, executionData, workflowVersions } from '../db/schema.js';
import { lt, and, eq, inArray, sql, count } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import { CronJob } from 'cron';

// ============================================================================
// TYPES
// ============================================================================

export interface PruningConfig {
  // Execution retention settings
  executionRetentionDays: number;
  successfulExecutionRetentionDays?: number; // Override for successful executions
  failedExecutionRetentionDays?: number; // Override for failed executions
  // Version retention settings
  workflowVersionRetentionCount: number;
  // Batch settings
  batchSize: number;
  // Schedule
  cronSchedule: string;
}

export interface PruningStats {
  executionsDeleted: number;
  executionDataDeleted: number;
  versionsDeleted: number;
  spaceFreed?: number; // In bytes, if available
  duration: number; // In milliseconds
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PruningConfig = {
  executionRetentionDays: 30,
  successfulExecutionRetentionDays: 14, // Keep successful executions shorter
  failedExecutionRetentionDays: 90, // Keep failed executions longer for debugging
  workflowVersionRetentionCount: 50,
  batchSize: 1000,
  cronSchedule: '0 3 * * *', // 3 AM daily
};

// ============================================================================
// PRUNING SERVICE
// ============================================================================

class PruningService {
  private config: PruningConfig;
  private cronJob: CronJob | null = null;
  private isRunning = false;

  constructor(config: Partial<PruningConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PruningConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Pruning configuration updated', { config: this.config });
  }

  /**
   * Start automatic pruning on schedule
   */
  startScheduledPruning(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = new CronJob(
      this.config.cronSchedule,
      async () => {
        logger.info('Starting scheduled pruning job');
        try {
          const stats = await this.runFullPrune();
          logger.info('Scheduled pruning completed', { stats });
        } catch (error) {
          logger.error('Scheduled pruning failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      null,
      true,
      'UTC'
    );

    logger.info('Scheduled pruning started', {
      schedule: this.config.cronSchedule,
    });
  }

  /**
   * Stop scheduled pruning
   */
  stopScheduledPruning(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Scheduled pruning stopped');
    }
  }

  /**
   * Run full pruning operation
   */
  async runFullPrune(): Promise<PruningStats> {
    if (this.isRunning) {
      throw new Error('Pruning is already in progress');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const stats: PruningStats = {
        executionsDeleted: 0,
        executionDataDeleted: 0,
        versionsDeleted: 0,
        duration: 0,
      };

      // Prune executions
      const execStats = await this.pruneExecutions();
      stats.executionsDeleted = execStats.executionsDeleted;
      stats.executionDataDeleted = execStats.executionDataDeleted;

      // Prune workflow versions
      stats.versionsDeleted = await this.pruneAllWorkflowVersions();

      stats.duration = Date.now() - startTime;

      logger.info('Full pruning completed', { stats });
      return stats;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Prune old executions
   */
  async pruneExecutions(): Promise<{ executionsDeleted: number; executionDataDeleted: number }> {
    let totalExecutionsDeleted = 0;
    let totalExecutionDataDeleted = 0;

    // Calculate cutoff dates
    const now = new Date();
    const defaultCutoff = new Date(now.getTime() - this.config.executionRetentionDays * 24 * 60 * 60 * 1000);
    const successCutoff = this.config.successfulExecutionRetentionDays
      ? new Date(now.getTime() - this.config.successfulExecutionRetentionDays * 24 * 60 * 60 * 1000)
      : defaultCutoff;
    const failedCutoff = this.config.failedExecutionRetentionDays
      ? new Date(now.getTime() - this.config.failedExecutionRetentionDays * 24 * 60 * 60 * 1000)
      : defaultCutoff;

    // Delete successful executions older than successCutoff
    let hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: executions.id })
        .from(executions)
        .where(and(
          eq(executions.status, 'success'),
          lt(executions.startedAt, successCutoff)
        ))
        .limit(this.config.batchSize);

      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      const ids = batch.map(e => e.id);

      // Delete execution data first (foreign key)
      const dataResult = await db.delete(executionData)
        .where(inArray(executionData.executionId, ids));

      // Delete executions
      const execResult = await db.delete(executions)
        .where(inArray(executions.id, ids));

      totalExecutionsDeleted += batch.length;
      logger.debug(`Deleted batch of ${batch.length} successful executions`);
    }

    // Delete failed executions older than failedCutoff
    hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: executions.id })
        .from(executions)
        .where(and(
          eq(executions.status, 'failed'),
          lt(executions.startedAt, failedCutoff)
        ))
        .limit(this.config.batchSize);

      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      const ids = batch.map(e => e.id);

      await db.delete(executionData)
        .where(inArray(executionData.executionId, ids));

      await db.delete(executions)
        .where(inArray(executions.id, ids));

      totalExecutionsDeleted += batch.length;
      logger.debug(`Deleted batch of ${batch.length} failed executions`);
    }

    // Delete other executions (cancelled, pending) older than defaultCutoff
    hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: executions.id })
        .from(executions)
        .where(and(
          lt(executions.startedAt, defaultCutoff),
          inArray(executions.status, ['cancelled', 'pending', 'waiting'])
        ))
        .limit(this.config.batchSize);

      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      const ids = batch.map(e => e.id);

      await db.delete(executionData)
        .where(inArray(executionData.executionId, ids));

      await db.delete(executions)
        .where(inArray(executions.id, ids));

      totalExecutionsDeleted += batch.length;
    }

    logger.info('Execution pruning completed', {
      executionsDeleted: totalExecutionsDeleted,
      executionDataDeleted: totalExecutionDataDeleted,
    });

    return {
      executionsDeleted: totalExecutionsDeleted,
      executionDataDeleted: totalExecutionDataDeleted,
    };
  }

  /**
   * Prune versions for all workflows
   */
  async pruneAllWorkflowVersions(): Promise<number> {
    // Get all unique workflow IDs from versions
    const workflowIds = await db
      .selectDistinct({ workflowId: workflowVersions.workflowId })
      .from(workflowVersions);

    let totalDeleted = 0;

    for (const { workflowId } of workflowIds) {
      const deleted = await this.pruneWorkflowVersions(workflowId);
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  /**
   * Prune versions for a specific workflow
   */
  async pruneWorkflowVersions(workflowId: string): Promise<number> {
    // Get all versions ordered by version number (newest first)
    const allVersions = await db
      .select({ id: workflowVersions.id, versionNumber: workflowVersions.versionNumber })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(sql`${workflowVersions.versionNumber} DESC`);

    if (allVersions.length <= this.config.workflowVersionRetentionCount) {
      return 0;
    }

    // Get versions to delete (all except the latest N)
    const versionsToDelete = allVersions.slice(this.config.workflowVersionRetentionCount);
    const idsToDelete = versionsToDelete.map(v => v.id);

    if (idsToDelete.length === 0) {
      return 0;
    }

    // Delete in batches
    for (let i = 0; i < idsToDelete.length; i += this.config.batchSize) {
      const batch = idsToDelete.slice(i, i + this.config.batchSize);
      await db.delete(workflowVersions).where(inArray(workflowVersions.id, batch));
    }

    logger.debug(`Pruned ${idsToDelete.length} versions for workflow ${workflowId}`);
    return idsToDelete.length;
  }

  /**
   * Get pruning statistics (preview what would be deleted)
   */
  async getPruningPreview(): Promise<{
    executionsToDelete: number;
    executionDataToDelete: number;
    versionsToDelete: number;
  }> {
    const now = new Date();
    const defaultCutoff = new Date(now.getTime() - this.config.executionRetentionDays * 24 * 60 * 60 * 1000);
    const successCutoff = this.config.successfulExecutionRetentionDays
      ? new Date(now.getTime() - this.config.successfulExecutionRetentionDays * 24 * 60 * 60 * 1000)
      : defaultCutoff;
    const failedCutoff = this.config.failedExecutionRetentionDays
      ? new Date(now.getTime() - this.config.failedExecutionRetentionDays * 24 * 60 * 60 * 1000)
      : defaultCutoff;

    // Count executions to delete
    const [successCount] = await db
      .select({ count: count() })
      .from(executions)
      .where(and(
        eq(executions.status, 'success'),
        lt(executions.startedAt, successCutoff)
      ));

    const [failedCount] = await db
      .select({ count: count() })
      .from(executions)
      .where(and(
        eq(executions.status, 'failed'),
        lt(executions.startedAt, failedCutoff)
      ));

    const [otherCount] = await db
      .select({ count: count() })
      .from(executions)
      .where(and(
        lt(executions.startedAt, defaultCutoff),
        inArray(executions.status, ['cancelled', 'pending', 'waiting'])
      ));

    const executionsToDelete = (successCount?.count || 0) + (failedCount?.count || 0) + (otherCount?.count || 0);

    // Count versions to delete
    let versionsToDelete = 0;
    const workflowIds = await db
      .selectDistinct({ workflowId: workflowVersions.workflowId })
      .from(workflowVersions);

    for (const { workflowId } of workflowIds) {
      const [versionCount] = await db
        .select({ count: count() })
        .from(workflowVersions)
        .where(eq(workflowVersions.workflowId, workflowId));

      const totalVersions = versionCount?.count || 0;
      if (totalVersions > this.config.workflowVersionRetentionCount) {
        versionsToDelete += totalVersions - this.config.workflowVersionRetentionCount;
      }
    }

    return {
      executionsToDelete,
      executionDataToDelete: executionsToDelete, // Approximate
      versionsToDelete,
    };
  }

  /**
   * Delete all executions for a specific workflow
   */
  async deleteWorkflowExecutions(workflowId: string): Promise<number> {
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await db
        .select({ id: executions.id })
        .from(executions)
        .where(eq(executions.workflowId, workflowId))
        .limit(this.config.batchSize);

      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      const ids = batch.map(e => e.id);

      await db.delete(executionData)
        .where(inArray(executionData.executionId, ids));

      await db.delete(executions)
        .where(inArray(executions.id, ids));

      totalDeleted += batch.length;
    }

    logger.info(`Deleted ${totalDeleted} executions for workflow ${workflowId}`);
    return totalDeleted;
  }

  /**
   * Archive old executions (move to archive table instead of delete)
   * This is a placeholder for future implementation
   */
  async archiveExecutions(olderThanDays: number): Promise<number> {
    // TODO: Implement archiving to a separate archive table or external storage
    logger.warn('Execution archiving is not yet implemented');
    return 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): PruningConfig {
    return { ...this.config };
  }

  /**
   * Check if pruning is currently running
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance with default configuration
export const pruningService = new PruningService();

// Export class for custom instances
export { PruningService };

// @ts-nocheck
/**
 * Data Retention Policy Service
 * Manages automatic cleanup of execution data, logs, and other time-sensitive data
 */

import { EventEmitter } from 'events';

export interface RetentionPolicy {
  id: string;
  name: string;
  workspaceId: string;
  enabled: boolean;
  resourceType: RetentionResourceType;
  retentionPeriod: RetentionPeriod;
  conditions?: RetentionCondition[];
  actions: RetentionAction[];
  schedule: RetentionSchedule;
  lastRun?: Date;
  nextRun?: Date;
  stats: RetentionStats;
  createdAt: Date;
  updatedAt: Date;
}

export type RetentionResourceType =
  | 'executions'
  | 'execution_logs'
  | 'workflow_versions'
  | 'audit_logs'
  | 'api_logs'
  | 'webhook_logs'
  | 'temp_files'
  | 'binary_data'
  | 'credentials_history';

export interface RetentionPeriod {
  value: number;
  unit: 'hours' | 'days' | 'weeks' | 'months' | 'years';
}

export interface RetentionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'contains' | 'matches';
  value: any;
}

export interface RetentionAction {
  type: 'delete' | 'archive' | 'anonymize' | 'export';
  config?: Record<string, any>;
}

export interface RetentionSchedule {
  type: 'cron' | 'interval';
  value: string; // cron expression or interval in ms
  timezone?: string;
}

export interface RetentionStats {
  totalProcessed: number;
  totalDeleted: number;
  totalArchived: number;
  totalAnonymized: number;
  totalExported: number;
  lastProcessedCount: number;
  lastRunDuration?: number;
  errors: number;
}

export interface RetentionJobResult {
  policyId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  processed: number;
  deleted: number;
  archived: number;
  anonymized: number;
  exported: number;
  errors: RetentionError[];
}

export interface RetentionError {
  resourceId: string;
  action: string;
  error: string;
  timestamp: Date;
}

interface RetentionTimer {
  policyId: string;
  timer: NodeJS.Timeout;
}

class RetentionPolicyService extends EventEmitter {
  private policies: Map<string, RetentionPolicy> = new Map();
  private scheduledJobs: Map<string, RetentionTimer> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobHistory: Map<string, RetentionJobResult[]> = new Map();

  // Resource-specific handlers
  private resourceHandlers: Map<RetentionResourceType, ResourceHandler> = new Map();

  constructor() {
    super();
    this.initializeResourceHandlers();
  }

  /**
   * Initialize handlers for different resource types
   */
  private initializeResourceHandlers(): void {
    // Executions handler
    this.resourceHandlers.set('executions', {
      count: async (workspaceId, conditions, olderThan) => {
        // Simulated - would query database
        return 0;
      },
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Deleting executions older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        console.log(`Archiving executions older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0, archivePath: config?.archivePath };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        console.log(`Anonymizing executions older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
    });

    // Execution logs handler
    this.resourceHandlers.set('execution_logs', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Deleting execution logs older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });

    // Workflow versions handler
    this.resourceHandlers.set('workflow_versions', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Deleting old workflow versions older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });

    // Audit logs handler
    this.resourceHandlers.set('audit_logs', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Deleting audit logs older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });

    // API logs handler
    this.resourceHandlers.set('api_logs', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });

    // Webhook logs handler
    this.resourceHandlers.set('webhook_logs', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });

    // Temp files handler
    this.resourceHandlers.set('temp_files', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Cleaning temp files older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async () => ({ processed: 0, affected: 0 }),
      anonymize: async () => ({ processed: 0, affected: 0 }),
    });

    // Binary data handler
    this.resourceHandlers.set('binary_data', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        console.log(`Deleting binary data older than ${olderThan.toISOString()}`);
        return { processed: 0, affected: 0 };
      },
      archive: async (workspaceId, conditions, olderThan, config) => {
        return { processed: 0, affected: 0 };
      },
      anonymize: async () => ({ processed: 0, affected: 0 }),
    });

    // Credentials history handler
    this.resourceHandlers.set('credentials_history', {
      count: async (workspaceId, conditions, olderThan) => 0,
      delete: async (workspaceId, conditions, olderThan, limit) => {
        return { processed: 0, affected: 0 };
      },
      archive: async () => ({ processed: 0, affected: 0 }),
      anonymize: async (workspaceId, conditions, olderThan, fields) => {
        return { processed: 0, affected: 0 };
      },
    });
  }

  /**
   * Create a new retention policy
   */
  createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): RetentionPolicy {
    const id = `rp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const newPolicy: RetentionPolicy = {
      ...policy,
      id,
      stats: {
        totalProcessed: 0,
        totalDeleted: 0,
        totalArchived: 0,
        totalAnonymized: 0,
        totalExported: 0,
        lastProcessedCount: 0,
        errors: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Calculate next run time
    newPolicy.nextRun = this.calculateNextRun(newPolicy.schedule);

    this.policies.set(id, newPolicy);

    // Schedule if enabled
    if (newPolicy.enabled) {
      this.schedulePolicy(newPolicy);
    }

    this.emit('policy:created', newPolicy);
    return newPolicy;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(id: string): RetentionPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get all policies for a workspace
   */
  getPolicies(workspaceId?: string): RetentionPolicy[] {
    const policies = Array.from(this.policies.values());
    if (workspaceId) {
      return policies.filter(p => p.workspaceId === workspaceId);
    }
    return policies;
  }

  /**
   * Update a policy
   */
  updatePolicy(id: string, updates: Partial<RetentionPolicy>): RetentionPolicy | null {
    const policy = this.policies.get(id);
    if (!policy) return null;

    const updatedPolicy: RetentionPolicy = {
      ...policy,
      ...updates,
      id: policy.id,
      createdAt: policy.createdAt,
      updatedAt: new Date(),
    };

    // Recalculate next run if schedule changed
    if (updates.schedule) {
      updatedPolicy.nextRun = this.calculateNextRun(updatedPolicy.schedule);
    }

    this.policies.set(id, updatedPolicy);

    // Reschedule if enabled status or schedule changed
    this.unschedulePolicy(id);
    if (updatedPolicy.enabled) {
      this.schedulePolicy(updatedPolicy);
    }

    this.emit('policy:updated', updatedPolicy);
    return updatedPolicy;
  }

  /**
   * Delete a policy
   */
  deletePolicy(id: string): boolean {
    const policy = this.policies.get(id);
    if (!policy) return false;

    this.unschedulePolicy(id);
    this.policies.delete(id);

    this.emit('policy:deleted', { id });
    return true;
  }

  /**
   * Enable/disable a policy
   */
  setEnabled(id: string, enabled: boolean): RetentionPolicy | null {
    return this.updatePolicy(id, { enabled });
  }

  /**
   * Manually trigger a policy execution
   */
  async runPolicy(id: string): Promise<RetentionJobResult> {
    const policy = this.policies.get(id);
    if (!policy) {
      throw new Error(`Policy not found: ${id}`);
    }

    if (this.runningJobs.has(id)) {
      throw new Error(`Policy ${id} is already running`);
    }

    return this.executePolicy(policy);
  }

  /**
   * Execute a retention policy
   */
  private async executePolicy(policy: RetentionPolicy): Promise<RetentionJobResult> {
    const startTime = new Date();
    this.runningJobs.add(policy.id);
    this.emit('policy:started', { policyId: policy.id, startTime });

    const result: RetentionJobResult = {
      policyId: policy.id,
      startTime,
      endTime: new Date(),
      duration: 0,
      processed: 0,
      deleted: 0,
      archived: 0,
      anonymized: 0,
      exported: 0,
      errors: [],
    };

    try {
      const handler = this.resourceHandlers.get(policy.resourceType);
      if (!handler) {
        throw new Error(`No handler for resource type: ${policy.resourceType}`);
      }

      const olderThan = this.calculateOlderThanDate(policy.retentionPeriod);

      for (const action of policy.actions) {
        try {
          switch (action.type) {
            case 'delete': {
              const deleteResult = await handler.delete(
                policy.workspaceId,
                policy.conditions || [],
                olderThan,
                action.config?.batchSize || 1000
              );
              result.processed += deleteResult.processed;
              result.deleted += deleteResult.affected;
              break;
            }

            case 'archive': {
              const archiveResult = await handler.archive(
                policy.workspaceId,
                policy.conditions || [],
                olderThan,
                action.config
              );
              result.processed += archiveResult.processed;
              result.archived += archiveResult.affected;
              break;
            }

            case 'anonymize': {
              const anonymizeResult = await handler.anonymize(
                policy.workspaceId,
                policy.conditions || [],
                olderThan,
                action.config?.fields || []
              );
              result.processed += anonymizeResult.processed;
              result.anonymized += anonymizeResult.affected;
              break;
            }

            case 'export': {
              // Export before delete/archive
              console.log(`Exporting data for policy ${policy.id}`);
              result.exported += 0; // Would export data
              break;
            }
          }
        } catch (error: any) {
          result.errors.push({
            resourceId: '',
            action: action.type,
            error: error.message,
            timestamp: new Date(),
          });
        }
      }
    } catch (error: any) {
      result.errors.push({
        resourceId: '',
        action: 'execute',
        error: error.message,
        timestamp: new Date(),
      });
    } finally {
      this.runningJobs.delete(policy.id);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      // Update policy stats
      this.updatePolicyStats(policy.id, result);

      // Store job history
      this.storeJobResult(policy.id, result);

      this.emit('policy:completed', result);
    }

    return result;
  }

  /**
   * Update policy statistics after a run
   */
  private updatePolicyStats(policyId: string, result: RetentionJobResult): void {
    const policy = this.policies.get(policyId);
    if (!policy) return;

    policy.stats.totalProcessed += result.processed;
    policy.stats.totalDeleted += result.deleted;
    policy.stats.totalArchived += result.archived;
    policy.stats.totalAnonymized += result.anonymized;
    policy.stats.totalExported += result.exported;
    policy.stats.lastProcessedCount = result.processed;
    policy.stats.lastRunDuration = result.duration;
    policy.stats.errors += result.errors.length;
    policy.lastRun = result.startTime;
    policy.nextRun = this.calculateNextRun(policy.schedule);
    policy.updatedAt = new Date();

    this.policies.set(policyId, policy);
  }

  /**
   * Store job result in history
   */
  private storeJobResult(policyId: string, result: RetentionJobResult): void {
    if (!this.jobHistory.has(policyId)) {
      this.jobHistory.set(policyId, []);
    }

    const history = this.jobHistory.get(policyId)!;
    history.push(result);

    // Keep only last 100 results
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get job history for a policy
   */
  getJobHistory(policyId: string, limit = 10): RetentionJobResult[] {
    const history = this.jobHistory.get(policyId) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Schedule a policy for automatic execution
   */
  private schedulePolicy(policy: RetentionPolicy): void {
    const schedule = policy.schedule;

    if (schedule.type === 'interval') {
      const intervalMs = parseInt(schedule.value, 10);
      const timer = setInterval(() => {
        this.executePolicy(policy).catch(err => {
          console.error(`Error executing policy ${policy.id}:`, err);
        });
      }, intervalMs);

      this.scheduledJobs.set(policy.id, { policyId: policy.id, timer });
    } else if (schedule.type === 'cron') {
      // For cron, we use a simpler interval-based approach
      // In production, would use a proper cron library
      const checkInterval = 60000; // Check every minute
      const timer = setInterval(() => {
        if (this.shouldRunCron(policy.schedule.value)) {
          this.executePolicy(policy).catch(err => {
            console.error(`Error executing policy ${policy.id}:`, err);
          });
        }
      }, checkInterval);

      this.scheduledJobs.set(policy.id, { policyId: policy.id, timer });
    }

    console.log(`Scheduled retention policy: ${policy.name} (${policy.id})`);
  }

  /**
   * Unschedule a policy
   */
  private unschedulePolicy(policyId: string): void {
    const job = this.scheduledJobs.get(policyId);
    if (job) {
      clearInterval(job.timer);
      this.scheduledJobs.delete(policyId);
      console.log(`Unscheduled retention policy: ${policyId}`);
    }
  }

  /**
   * Simple cron check (simplified - would use proper cron parser in production)
   */
  private shouldRunCron(cronExpression: string): boolean {
    const now = new Date();
    const parts = cronExpression.split(' ');

    if (parts.length !== 5) return false;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const matches = (cronPart: string, value: number): boolean => {
      if (cronPart === '*') return true;
      if (cronPart.includes('/')) {
        const [, step] = cronPart.split('/');
        return value % parseInt(step, 10) === 0;
      }
      if (cronPart.includes(',')) {
        return cronPart.split(',').map(Number).includes(value);
      }
      if (cronPart.includes('-')) {
        const [start, end] = cronPart.split('-').map(Number);
        return value >= start && value <= end;
      }
      return parseInt(cronPart, 10) === value;
    };

    return (
      matches(minute, now.getMinutes()) &&
      matches(hour, now.getHours()) &&
      matches(dayOfMonth, now.getDate()) &&
      matches(month, now.getMonth() + 1) &&
      matches(dayOfWeek, now.getDay())
    );
  }

  /**
   * Calculate the date threshold for retention
   */
  private calculateOlderThanDate(period: RetentionPeriod): Date {
    const now = new Date();
    const ms = {
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000,
      years: 365 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - period.value * ms[period.unit]);
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: RetentionSchedule): Date {
    const now = new Date();

    if (schedule.type === 'interval') {
      const intervalMs = parseInt(schedule.value, 10);
      return new Date(now.getTime() + intervalMs);
    }

    // For cron, find next matching time (simplified)
    // In production, would use proper cron parser
    return new Date(now.getTime() + 60000); // Default to 1 minute
  }

  /**
   * Get preview of what would be affected by a policy
   */
  async previewPolicy(policy: Partial<RetentionPolicy>): Promise<{
    resourceType: RetentionResourceType;
    estimatedCount: number;
    olderThanDate: Date;
  }> {
    if (!policy.resourceType || !policy.retentionPeriod || !policy.workspaceId) {
      throw new Error('Missing required policy fields for preview');
    }

    const handler = this.resourceHandlers.get(policy.resourceType);
    if (!handler) {
      throw new Error(`No handler for resource type: ${policy.resourceType}`);
    }

    const olderThan = this.calculateOlderThanDate(policy.retentionPeriod);
    const count = await handler.count(
      policy.workspaceId,
      policy.conditions || [],
      olderThan
    );

    return {
      resourceType: policy.resourceType,
      estimatedCount: count,
      olderThanDate: olderThan,
    };
  }

  /**
   * Get all running jobs
   */
  getRunningJobs(): string[] {
    return Array.from(this.runningJobs);
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    for (const [policyId] of this.scheduledJobs) {
      this.unschedulePolicy(policyId);
    }
    console.log('All retention policy jobs stopped');
  }

  /**
   * Start all enabled policies
   */
  startAll(): void {
    for (const policy of this.policies.values()) {
      if (policy.enabled) {
        this.schedulePolicy(policy);
      }
    }
    console.log('All enabled retention policies started');
  }

  /**
   * Get global retention statistics
   */
  getGlobalStats(): {
    totalPolicies: number;
    enabledPolicies: number;
    runningJobs: number;
    totalProcessed: number;
    totalDeleted: number;
    totalArchived: number;
    totalErrors: number;
  } {
    const policies = Array.from(this.policies.values());

    return {
      totalPolicies: policies.length,
      enabledPolicies: policies.filter(p => p.enabled).length,
      runningJobs: this.runningJobs.size,
      totalProcessed: policies.reduce((sum, p) => sum + p.stats.totalProcessed, 0),
      totalDeleted: policies.reduce((sum, p) => sum + p.stats.totalDeleted, 0),
      totalArchived: policies.reduce((sum, p) => sum + p.stats.totalArchived, 0),
      totalErrors: policies.reduce((sum, p) => sum + p.stats.errors, 0),
    };
  }

  /**
   * Create default policies for a workspace
   */
  createDefaultPolicies(workspaceId: string): RetentionPolicy[] {
    const defaultPolicies: Array<Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt' | 'stats'>> = [
      {
        name: 'Execution Cleanup (30 days)',
        workspaceId,
        enabled: true,
        resourceType: 'executions',
        retentionPeriod: { value: 30, unit: 'days' },
        conditions: [{ field: 'status', operator: 'in', value: ['success', 'error'] }],
        actions: [{ type: 'delete' }],
        schedule: { type: 'cron', value: '0 2 * * *' }, // Daily at 2 AM
      },
      {
        name: 'Execution Logs Cleanup (7 days)',
        workspaceId,
        enabled: true,
        resourceType: 'execution_logs',
        retentionPeriod: { value: 7, unit: 'days' },
        actions: [{ type: 'delete' }],
        schedule: { type: 'cron', value: '0 3 * * *' }, // Daily at 3 AM
      },
      {
        name: 'Temp Files Cleanup (24 hours)',
        workspaceId,
        enabled: true,
        resourceType: 'temp_files',
        retentionPeriod: { value: 24, unit: 'hours' },
        actions: [{ type: 'delete' }],
        schedule: { type: 'interval', value: '3600000' }, // Every hour
      },
      {
        name: 'Binary Data Archive (90 days)',
        workspaceId,
        enabled: false,
        resourceType: 'binary_data',
        retentionPeriod: { value: 90, unit: 'days' },
        actions: [
          { type: 'archive', config: { archivePath: '/archives' } },
          { type: 'delete' },
        ],
        schedule: { type: 'cron', value: '0 4 * * 0' }, // Weekly on Sunday at 4 AM
      },
    ];

    return defaultPolicies.map(policy => this.createPolicy(policy));
  }
}

// Resource handler interface
interface ResourceHandler {
  count: (workspaceId: string, conditions: RetentionCondition[], olderThan: Date) => Promise<number>;
  delete: (workspaceId: string, conditions: RetentionCondition[], olderThan: Date, limit: number) => Promise<{ processed: number; affected: number }>;
  archive: (workspaceId: string, conditions: RetentionCondition[], olderThan: Date, config?: Record<string, any>) => Promise<{ processed: number; affected: number; archivePath?: string }>;
  anonymize: (workspaceId: string, conditions: RetentionCondition[], olderThan: Date, fields: string[]) => Promise<{ processed: number; affected: number }>;
}

// Export singleton instance
export const retentionPolicyService = new RetentionPolicyService();
export default RetentionPolicyService;

/**
 * Data Retention Policy Routes
 * API endpoints for managing retention policies
 */

import { Router, Request, Response } from 'express';
import {
  retentionPolicyService,
  RetentionPolicy,
  RetentionResourceType,
  RetentionPeriod,
  RetentionSchedule,
} from '../services/RetentionPolicyService.js';

const router = Router();

// ============ Policies ============

/**
 * List all retention policies
 */
router.get('/policies', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const policies = retentionPolicyService.getPolicies(workspaceId);

    res.json({
      policies,
      stats: retentionPolicyService.getGlobalStats(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a policy by ID
 */
router.get('/policies/:id', async (req: Request, res: Response) => {
  try {
    const policy = retentionPolicyService.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Include job history
    const history = retentionPolicyService.getJobHistory(req.params.id);

    res.json({ policy, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new retention policy
 */
router.post('/policies', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const {
      name,
      resourceType,
      retentionPeriod,
      conditions,
      actions,
      schedule,
      enabled = true,
    } = req.body;

    // Validation
    if (!name || !resourceType || !retentionPeriod || !actions?.length || !schedule) {
      return res.status(400).json({
        error: 'Missing required fields: name, resourceType, retentionPeriod, actions, schedule',
      });
    }

    const validResourceTypes: RetentionResourceType[] = [
      'executions',
      'execution_logs',
      'workflow_versions',
      'audit_logs',
      'api_logs',
      'webhook_logs',
      'temp_files',
      'binary_data',
      'credentials_history',
    ];

    if (!validResourceTypes.includes(resourceType)) {
      return res.status(400).json({
        error: `Invalid resource type. Valid types: ${validResourceTypes.join(', ')}`,
      });
    }

    const policy = retentionPolicyService.createPolicy({
      name,
      workspaceId,
      enabled,
      resourceType,
      retentionPeriod,
      conditions,
      actions,
      schedule,
    });

    res.status(201).json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a retention policy
 */
router.patch('/policies/:id', async (req: Request, res: Response) => {
  try {
    const {
      name,
      enabled,
      retentionPeriod,
      conditions,
      actions,
      schedule,
    } = req.body;

    const updated = retentionPolicyService.updatePolicy(req.params.id, {
      name,
      enabled,
      retentionPeriod,
      conditions,
      actions,
      schedule,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a retention policy
 */
router.delete('/policies/:id', async (req: Request, res: Response) => {
  try {
    const deleted = retentionPolicyService.deletePolicy(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Enable/disable a policy
 */
router.post('/policies/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const updated = retentionPolicyService.setEnabled(req.params.id, enabled);
    if (!updated) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run a policy manually
 */
router.post('/policies/:id/run', async (req: Request, res: Response) => {
  try {
    const result = await retentionPolicyService.runPolicy(req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('already running')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preview policy effects (dry run)
 */
router.post('/policies/preview', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { resourceType, retentionPeriod, conditions } = req.body;

    if (!resourceType || !retentionPeriod) {
      return res.status(400).json({ error: 'resourceType and retentionPeriod are required' });
    }

    const preview = await retentionPolicyService.previewPolicy({
      workspaceId,
      resourceType,
      retentionPeriod,
      conditions,
    });

    res.json(preview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get job history for a policy
 */
router.get('/policies/:id/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const history = retentionPolicyService.getJobHistory(req.params.id, limit);

    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Global Operations ============

/**
 * Get global statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = retentionPolicyService.getGlobalStats();
    const runningJobs = retentionPolicyService.getRunningJobs();

    res.json({ stats, runningJobs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get currently running jobs
 */
router.get('/jobs/running', async (req: Request, res: Response) => {
  try {
    const runningJobs = retentionPolicyService.getRunningJobs();

    res.json({
      count: runningJobs.length,
      jobs: runningJobs.map(policyId => ({
        policyId,
        policy: retentionPolicyService.getPolicy(policyId),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create default policies for workspace
 */
router.post('/policies/defaults', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const policies = retentionPolicyService.createDefaultPolicies(workspaceId);

    res.status(201).json({
      message: `Created ${policies.length} default policies`,
      policies,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Reference Data ============

/**
 * Get available resource types
 */
router.get('/resource-types', async (req: Request, res: Response) => {
  res.json([
    {
      value: 'executions',
      label: 'Executions',
      description: 'Workflow execution records and their data',
    },
    {
      value: 'execution_logs',
      label: 'Execution Logs',
      description: 'Detailed logs from workflow executions',
    },
    {
      value: 'workflow_versions',
      label: 'Workflow Versions',
      description: 'Historical versions of workflows',
    },
    {
      value: 'audit_logs',
      label: 'Audit Logs',
      description: 'User activity and system audit trail',
    },
    {
      value: 'api_logs',
      label: 'API Logs',
      description: 'API request/response logs',
    },
    {
      value: 'webhook_logs',
      label: 'Webhook Logs',
      description: 'Incoming webhook request logs',
    },
    {
      value: 'temp_files',
      label: 'Temporary Files',
      description: 'Temporary files created during execution',
    },
    {
      value: 'binary_data',
      label: 'Binary Data',
      description: 'File attachments and binary data',
    },
    {
      value: 'credentials_history',
      label: 'Credentials History',
      description: 'Historical credential versions',
    },
  ]);
});

/**
 * Get available retention periods
 */
router.get('/period-presets', async (req: Request, res: Response) => {
  const presets: Array<{ label: string; period: RetentionPeriod }> = [
    { label: '1 Hour', period: { value: 1, unit: 'hours' } },
    { label: '24 Hours', period: { value: 24, unit: 'hours' } },
    { label: '7 Days', period: { value: 7, unit: 'days' } },
    { label: '14 Days', period: { value: 14, unit: 'days' } },
    { label: '30 Days', period: { value: 30, unit: 'days' } },
    { label: '60 Days', period: { value: 60, unit: 'days' } },
    { label: '90 Days', period: { value: 90, unit: 'days' } },
    { label: '6 Months', period: { value: 6, unit: 'months' } },
    { label: '1 Year', period: { value: 1, unit: 'years' } },
    { label: '2 Years', period: { value: 2, unit: 'years' } },
    { label: '5 Years', period: { value: 5, unit: 'years' } },
    { label: '7 Years', period: { value: 7, unit: 'years' } },
  ];

  res.json(presets);
});

/**
 * Get available schedule presets
 */
router.get('/schedule-presets', async (req: Request, res: Response) => {
  const presets: Array<{ label: string; schedule: RetentionSchedule }> = [
    { label: 'Every Hour', schedule: { type: 'interval', value: '3600000' } },
    { label: 'Every 6 Hours', schedule: { type: 'interval', value: '21600000' } },
    { label: 'Every 12 Hours', schedule: { type: 'interval', value: '43200000' } },
    { label: 'Daily at Midnight', schedule: { type: 'cron', value: '0 0 * * *' } },
    { label: 'Daily at 2 AM', schedule: { type: 'cron', value: '0 2 * * *' } },
    { label: 'Weekly (Sunday at Midnight)', schedule: { type: 'cron', value: '0 0 * * 0' } },
    { label: 'Monthly (1st at Midnight)', schedule: { type: 'cron', value: '0 0 1 * *' } },
  ];

  res.json(presets);
});

/**
 * Get available actions
 */
router.get('/actions', async (req: Request, res: Response) => {
  res.json([
    {
      value: 'delete',
      label: 'Delete',
      description: 'Permanently delete matching records',
      config: {
        batchSize: { type: 'number', default: 1000, description: 'Records to process per batch' },
      },
    },
    {
      value: 'archive',
      label: 'Archive',
      description: 'Move records to archive storage',
      config: {
        archivePath: { type: 'string', description: 'Archive storage path' },
        compress: { type: 'boolean', default: true, description: 'Compress archived data' },
      },
    },
    {
      value: 'anonymize',
      label: 'Anonymize',
      description: 'Remove or mask PII from records',
      config: {
        fields: { type: 'array', items: 'string', description: 'Fields to anonymize' },
      },
    },
    {
      value: 'export',
      label: 'Export',
      description: 'Export data before deletion (for compliance)',
      config: {
        format: { type: 'string', enum: ['json', 'csv', 'parquet'], default: 'json' },
        destination: { type: 'string', description: 'Export destination (S3, GCS, etc.)' },
      },
    },
  ]);
});

/**
 * Validate a cron expression
 */
router.post('/validate-cron', async (req: Request, res: Response) => {
  try {
    const { expression } = req.body;

    if (!expression) {
      return res.status(400).json({ error: 'Cron expression is required' });
    }

    const parts = expression.split(' ');
    if (parts.length !== 5) {
      return res.status(400).json({
        valid: false,
        error: 'Cron expression must have 5 parts: minute hour dayOfMonth month dayOfWeek',
      });
    }

    // Simple validation
    const patterns = [
      /^(\*|[0-9]|[1-5][0-9])(\/[0-9]+)?$/, // minute: 0-59
      /^(\*|[0-9]|1[0-9]|2[0-3])(\/[0-9]+)?$/, // hour: 0-23
      /^(\*|[1-9]|[12][0-9]|3[01])(\/[0-9]+)?$/, // day of month: 1-31
      /^(\*|[1-9]|1[0-2])(\/[0-9]+)?$/, // month: 1-12
      /^(\*|[0-6])(\/[0-9]+)?$/, // day of week: 0-6
    ];

    const errors: string[] = [];
    parts.forEach((part, i) => {
      // Handle ranges and lists
      const values = part.split(',');
      for (const value of values) {
        const rangeMatch = value.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) continue; // Range syntax
        if (!patterns[i].test(value) && value !== '*') {
          errors.push(`Invalid value in position ${i + 1}: ${value}`);
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    res.json({
      valid: true,
      parsed: {
        minute: parts[0],
        hour: parts[1],
        dayOfMonth: parts[2],
        month: parts[3],
        dayOfWeek: parts[4],
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const retentionRouter = router;

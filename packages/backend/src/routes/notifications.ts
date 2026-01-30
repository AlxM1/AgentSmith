/**
 * Notification Routes - Manage alert channels and rules
 */

import { Router, Request, Response } from 'express';
import {
  notificationService,
  NotificationChannel,
  NotificationRule,
  NotificationChannelType,
} from '../services/NotificationService.js';

const router = Router();

// ============ Channels ============

/**
 * List notification channels
 */
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const channels = notificationService.getChannels(workspaceId);

    // Mask sensitive data
    const safeChannels = channels.map(ch => ({
      ...ch,
      config: maskSensitiveConfig(ch.config, ch.type),
    }));

    res.json(safeChannels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get channel by ID
 */
router.get('/channels/:id', async (req: Request, res: Response) => {
  try {
    const channel = notificationService.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({
      ...channel,
      config: maskSensitiveConfig(channel.config, channel.type),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create notification channel
 */
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const userId = (req as any).user?.id;
    const { type, name, config } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const validTypes: NotificationChannelType[] = [
      'email', 'slack', 'discord', 'teams', 'webhook', 'sms', 'pagerduty', 'opsgenie'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid channel type' });
    }

    const channel: NotificationChannel = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      config: config || {},
      enabled: true,
      workspaceId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    notificationService.addChannel(channel);

    res.status(201).json({
      ...channel,
      config: maskSensitiveConfig(channel.config, channel.type),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update notification channel
 */
router.patch('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { name, config, enabled } = req.body;

    const updated = notificationService.updateChannel(req.params.id, {
      name,
      config,
      enabled,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({
      ...updated,
      config: maskSensitiveConfig(updated.config, updated.type),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete notification channel
 */
router.delete('/channels/:id', async (req: Request, res: Response) => {
  try {
    const deleted = notificationService.deleteChannel(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test notification channel
 */
router.post('/channels/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await notificationService.testChannel(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Rules ============

/**
 * List notification rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const rules = notificationService.getRules(workspaceId);
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create notification rule
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { name, trigger, conditions, channels, throttle, schedule } = req.body;

    if (!name || !trigger || !channels?.length) {
      return res.status(400).json({ error: 'Name, trigger, and channels are required' });
    }

    const rule: NotificationRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      workspaceId,
      enabled: true,
      trigger,
      conditions: conditions || [],
      channels,
      throttle,
      schedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    notificationService.addRule(rule);

    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update notification rule
 */
router.patch('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { name, enabled, trigger, conditions, channels, throttle, schedule } = req.body;

    const updated = notificationService.updateRule(req.params.id, {
      name,
      enabled,
      trigger,
      conditions,
      channels,
      throttle,
      schedule,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete notification rule
 */
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const deleted = notificationService.deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available trigger types
 */
router.get('/trigger-types', async (req: Request, res: Response) => {
  res.json([
    { value: 'execution_failed', label: 'Execution Failed', description: 'Triggered when a workflow execution fails' },
    { value: 'execution_timeout', label: 'Execution Timeout', description: 'Triggered when a workflow execution times out' },
    { value: 'workflow_error', label: 'Workflow Error', description: 'Triggered on workflow configuration errors' },
    { value: 'queue_stuck', label: 'Queue Stuck', description: 'Triggered when execution queue is stuck' },
    { value: 'system_error', label: 'System Error', description: 'Triggered on system-level errors' },
    { value: 'custom', label: 'Custom Event', description: 'Triggered on custom events' },
  ]);
});

/**
 * Get channel type configuration schema
 */
router.get('/channel-schemas', async (req: Request, res: Response) => {
  res.json({
    email: {
      required: ['recipients'],
      properties: {
        recipients: { type: 'array', items: { type: 'string', format: 'email' }, description: 'Email addresses' },
        from: { type: 'string', format: 'email', description: 'Sender address' },
      },
    },
    slack: {
      required: ['webhookUrl'],
      properties: {
        webhookUrl: { type: 'string', format: 'uri', description: 'Slack webhook URL' },
        channel: { type: 'string', description: 'Channel name (optional)' },
        username: { type: 'string', description: 'Bot username' },
        iconEmoji: { type: 'string', description: 'Bot icon emoji' },
      },
    },
    discord: {
      required: ['webhookUrl'],
      properties: {
        webhookUrl: { type: 'string', format: 'uri', description: 'Discord webhook URL' },
      },
    },
    teams: {
      required: ['webhookUrl'],
      properties: {
        webhookUrl: { type: 'string', format: 'uri', description: 'Teams webhook URL' },
      },
    },
    webhook: {
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri', description: 'Webhook URL' },
        method: { type: 'string', enum: ['POST', 'PUT'], default: 'POST' },
        headers: { type: 'object', description: 'Custom headers' },
      },
    },
    pagerduty: {
      required: ['routingKey'],
      properties: {
        routingKey: { type: 'string', description: 'PagerDuty routing key' },
      },
    },
    opsgenie: {
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'OpsGenie API key' },
      },
    },
  });
});

// Helper function to mask sensitive configuration data
function maskSensitiveConfig(config: Record<string, any>, type: NotificationChannelType): Record<string, any> {
  const masked = { ...config };
  const sensitiveFields = ['apiKey', 'routingKey', 'webhookUrl', 'password', 'token'];

  for (const field of sensitiveFields) {
    if (masked[field]) {
      const value = String(masked[field]);
      masked[field] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
    }
  }

  return masked;
}

export const notificationsRouter = router;

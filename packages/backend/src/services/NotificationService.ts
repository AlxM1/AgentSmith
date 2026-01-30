// @ts-nocheck
/**
 * Notification Service
 * Handles alerts for execution failures, system events, and user notifications
 * Supports Email, Slack, Discord, Microsoft Teams, Webhooks, and SMS
 */

import { EventEmitter } from 'events';

export interface NotificationChannel {
  id: string;
  type: NotificationChannelType;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  workspaceId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationChannelType =
  | 'email'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'webhook'
  | 'sms'
  | 'pagerduty'
  | 'opsgenie';

export interface NotificationRule {
  id: string;
  name: string;
  workspaceId?: string;
  enabled: boolean;
  trigger: NotificationTrigger;
  conditions: NotificationCondition[];
  channels: string[]; // Channel IDs
  throttle?: {
    count: number;
    windowMinutes: number;
  };
  schedule?: {
    timezone: string;
    activeHours?: { start: string; end: string };
    activeDays?: number[]; // 0-6 (Sunday-Saturday)
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTrigger {
  type: 'execution_failed' | 'execution_timeout' | 'workflow_error' | 'queue_stuck' | 'system_error' | 'custom';
  workflowIds?: string[]; // Empty = all workflows
  tags?: string[];
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'regex';
  value: any;
}

export interface Notification {
  id: string;
  ruleId?: string;
  channelId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'throttled';
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  data?: {
    workflowId?: string;
    workflowName?: string;
    executionId?: string;
    errorMessage?: string;
    timestamp?: string;
    environment?: string;
    [key: string]: any;
  };
  links?: {
    workflow?: string;
    execution?: string;
    dashboard?: string;
  };
}

class NotificationService extends EventEmitter {
  private channels: Map<string, NotificationChannel> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private throttleTracker: Map<string, { count: number; windowStart: Date }> = new Map();
  private baseUrl: string = process.env.APP_URL || 'http://localhost:5678';

  constructor() {
    super();
    this.setupDefaultChannels();
  }

  private setupDefaultChannels() {
    // System email channel (uses configured SMTP)
    if (process.env.SMTP_HOST) {
      this.addChannel({
        id: 'system-email',
        type: 'email',
        name: 'System Email',
        config: {
          from: process.env.SMTP_FROM || 'notifications@agentsmith.local',
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Add a notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    this.emit('channel:added', channel);
  }

  /**
   * Get channel by ID
   */
  getChannel(id: string): NotificationChannel | undefined {
    return this.channels.get(id);
  }

  /**
   * Get all channels for a workspace
   */
  getChannels(workspaceId?: string): NotificationChannel[] {
    return Array.from(this.channels.values()).filter(
      ch => !workspaceId || ch.workspaceId === workspaceId || !ch.workspaceId
    );
  }

  /**
   * Update a channel
   */
  updateChannel(id: string, updates: Partial<NotificationChannel>): NotificationChannel | null {
    const channel = this.channels.get(id);
    if (!channel) return null;

    const updated = { ...channel, ...updates, updatedAt: new Date() };
    this.channels.set(id, updated);
    this.emit('channel:updated', updated);
    return updated;
  }

  /**
   * Delete a channel
   */
  deleteChannel(id: string): boolean {
    const deleted = this.channels.delete(id);
    if (deleted) this.emit('channel:deleted', id);
    return deleted;
  }

  /**
   * Add a notification rule
   */
  addRule(rule: NotificationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule:added', rule);
  }

  /**
   * Get all rules for a workspace
   */
  getRules(workspaceId?: string): NotificationRule[] {
    return Array.from(this.rules.values()).filter(
      r => !workspaceId || r.workspaceId === workspaceId || !r.workspaceId
    );
  }

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<NotificationRule>): NotificationRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updated = { ...rule, ...updates, updatedAt: new Date() };
    this.rules.set(id, updated);
    this.emit('rule:updated', updated);
    return updated;
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id);
    if (deleted) this.emit('rule:deleted', id);
    return deleted;
  }

  /**
   * Send notification based on event
   */
  async notify(payload: NotificationPayload, workspaceId?: string): Promise<void> {
    const matchingRules = this.findMatchingRules(payload, workspaceId);

    for (const rule of matchingRules) {
      if (!this.isWithinSchedule(rule)) continue;
      if (this.isThrottled(rule)) continue;

      for (const channelId of rule.channels) {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.enabled) continue;

        await this.sendToChannel(channel, payload, rule.id);
      }

      this.updateThrottle(rule);
    }
  }

  /**
   * Send execution failure notification
   */
  async notifyExecutionFailed(execution: {
    id: string;
    workflowId: string;
    workflowName: string;
    error: string;
    startedAt: Date;
    stoppedAt: Date;
  }, workspaceId?: string): Promise<void> {
    const payload: NotificationPayload = {
      type: 'execution_failed',
      title: `Workflow Failed: ${execution.workflowName}`,
      message: `Execution ${execution.id} failed with error: ${execution.error}`,
      severity: 'error',
      data: {
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        executionId: execution.id,
        errorMessage: execution.error,
        timestamp: new Date().toISOString(),
        duration: execution.stoppedAt.getTime() - execution.startedAt.getTime(),
      },
      links: {
        workflow: `${this.baseUrl}/workflow/${execution.workflowId}`,
        execution: `${this.baseUrl}/execution/${execution.id}`,
      },
    };

    await this.notify(payload, workspaceId);
  }

  /**
   * Send execution timeout notification
   */
  async notifyExecutionTimeout(execution: {
    id: string;
    workflowId: string;
    workflowName: string;
    timeoutMs: number;
  }, workspaceId?: string): Promise<void> {
    const payload: NotificationPayload = {
      type: 'execution_timeout',
      title: `Workflow Timeout: ${execution.workflowName}`,
      message: `Execution ${execution.id} timed out after ${execution.timeoutMs / 1000}s`,
      severity: 'warning',
      data: {
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        executionId: execution.id,
        timeoutMs: execution.timeoutMs,
        timestamp: new Date().toISOString(),
      },
      links: {
        workflow: `${this.baseUrl}/workflow/${execution.workflowId}`,
        execution: `${this.baseUrl}/execution/${execution.id}`,
      },
    };

    await this.notify(payload, workspaceId);
  }

  /**
   * Send system error notification
   */
  async notifySystemError(error: {
    component: string;
    message: string;
    stack?: string;
  }): Promise<void> {
    const payload: NotificationPayload = {
      type: 'system_error',
      title: `System Error: ${error.component}`,
      message: error.message,
      severity: 'critical',
      data: {
        component: error.component,
        errorMessage: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      links: {
        dashboard: `${this.baseUrl}/admin/monitoring`,
      },
    };

    await this.notify(payload);
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    payload: NotificationPayload,
    ruleId?: string
  ): Promise<void> {
    const notification: Notification = {
      id: this.generateId(),
      ruleId,
      channelId: channel.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data,
      status: 'pending',
      createdAt: new Date(),
    };

    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmail(channel, payload);
          break;
        case 'slack':
          await this.sendSlack(channel, payload);
          break;
        case 'discord':
          await this.sendDiscord(channel, payload);
          break;
        case 'teams':
          await this.sendTeams(channel, payload);
          break;
        case 'webhook':
          await this.sendWebhook(channel, payload);
          break;
        case 'pagerduty':
          await this.sendPagerDuty(channel, payload);
          break;
        case 'opsgenie':
          await this.sendOpsGenie(channel, payload);
          break;
      }

      notification.status = 'sent';
      notification.sentAt = new Date();
    } catch (error: any) {
      notification.status = 'failed';
      notification.error = error.message;
      console.error(`Failed to send notification via ${channel.type}:`, error);
    }

    this.notifications.set(notification.id, notification);
    this.emit('notification:sent', notification);
  }

  /**
   * Send email notification
   */
  private async sendEmail(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const recipients = channel.config.recipients || [];
    const from = channel.config.from || 'notifications@agentsmith.local';

    // Use nodemailer or similar
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    const severityColors: Record<string, string> = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#8e44ad',
    };

    const html = this.generateEmailHtml(payload, severityColors[payload.severity]);

    await transporter.sendMail({
      from,
      to: recipients.join(', '),
      subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
      html,
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    const channelName = channel.config.channel;

    const severityColors: Record<string, string> = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#8e44ad',
    };

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: payload.title, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: payload.message },
      },
    ];

    if (payload.data) {
      const fields: any[] = [];
      if (payload.data.workflowName) {
        fields.push({ type: 'mrkdwn', text: `*Workflow:*\n${payload.data.workflowName}` });
      }
      if (payload.data.executionId) {
        fields.push({ type: 'mrkdwn', text: `*Execution ID:*\n${payload.data.executionId}` });
      }
      if (payload.data.timestamp) {
        fields.push({ type: 'mrkdwn', text: `*Time:*\n${payload.data.timestamp}` });
      }
      if (fields.length > 0) {
        blocks.push({ type: 'section', fields });
      }
    }

    if (payload.links) {
      const buttons: any[] = [];
      if (payload.links.workflow) {
        buttons.push({
          type: 'button',
          text: { type: 'plain_text', text: 'View Workflow' },
          url: payload.links.workflow,
        });
      }
      if (payload.links.execution) {
        buttons.push({
          type: 'button',
          text: { type: 'plain_text', text: 'View Execution' },
          url: payload.links.execution,
        });
      }
      if (buttons.length > 0) {
        blocks.push({ type: 'actions', elements: buttons });
      }
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: channelName,
        attachments: [{
          color: severityColors[payload.severity],
          blocks,
        }],
      }),
    });
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;

    const severityColors: Record<string, number> = {
      info: 0x3498db,
      warning: 0xf39c12,
      error: 0xe74c3c,
      critical: 0x8e44ad,
    };

    const embed: any = {
      title: payload.title,
      description: payload.message,
      color: severityColors[payload.severity],
      timestamp: new Date().toISOString(),
      fields: [],
    };

    if (payload.data?.workflowName) {
      embed.fields.push({ name: 'Workflow', value: payload.data.workflowName, inline: true });
    }
    if (payload.data?.executionId) {
      embed.fields.push({ name: 'Execution ID', value: payload.data.executionId, inline: true });
    }
    if (payload.data?.errorMessage) {
      embed.fields.push({ name: 'Error', value: payload.data.errorMessage.substring(0, 200) });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeams(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;

    const severityColors: Record<string, string> = {
      info: '0078D7',
      warning: 'FFC300',
      error: 'FF0000',
      critical: '8B008B',
    };

    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: severityColors[payload.severity],
      summary: payload.title,
      sections: [{
        activityTitle: payload.title,
        activitySubtitle: new Date().toISOString(),
        text: payload.message,
        facts: [] as any[],
      }],
      potentialAction: [] as any[],
    };

    if (payload.data?.workflowName) {
      card.sections[0].facts.push({ name: 'Workflow', value: payload.data.workflowName });
    }
    if (payload.data?.executionId) {
      card.sections[0].facts.push({ name: 'Execution ID', value: payload.data.executionId });
    }

    if (payload.links?.execution) {
      card.potentialAction.push({
        '@type': 'OpenUri',
        name: 'View Execution',
        targets: [{ os: 'default', uri: payload.links.execution }],
      });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
  }

  /**
   * Send generic webhook notification
   */
  private async sendWebhook(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const webhookUrl = channel.config.url;
    const headers = channel.config.headers || {};
    const method = channel.config.method || 'POST';

    await fetch(webhookUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        ...payload,
        sentAt: new Date().toISOString(),
      }),
    });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDuty(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const routingKey = channel.config.routingKey;

    const severityMap: Record<string, string> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: payload.title,
          severity: severityMap[payload.severity],
          source: 'AgentSmith',
          custom_details: payload.data,
        },
        links: payload.links ? [
          { href: payload.links.execution || payload.links.workflow, text: 'View Details' },
        ] : undefined,
      }),
    });
  }

  /**
   * Send OpsGenie notification
   */
  private async sendOpsGenie(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const apiKey = channel.config.apiKey;

    const priorityMap: Record<string, string> = {
      info: 'P5',
      warning: 'P3',
      error: 'P2',
      critical: 'P1',
    };

    await fetch('https://api.opsgenie.com/v2/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `GenieKey ${apiKey}`,
      },
      body: JSON.stringify({
        message: payload.title,
        description: payload.message,
        priority: priorityMap[payload.severity],
        details: payload.data,
      }),
    });
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHtml(payload: NotificationPayload, color: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: ${color}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 20px; }
    .message { color: #333; line-height: 1.6; margin-bottom: 20px; }
    .details { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
    .details-row { display: flex; margin-bottom: 8px; }
    .details-label { font-weight: 600; width: 120px; color: #666; }
    .details-value { flex: 1; color: #333; }
    .button { display: inline-block; padding: 12px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px; }
    .footer { padding: 15px 20px; background: #f8f9fa; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${payload.title}</h1>
    </div>
    <div class="content">
      <p class="message">${payload.message}</p>
      ${payload.data ? `
      <div class="details">
        ${payload.data.workflowName ? `<div class="details-row"><span class="details-label">Workflow:</span><span class="details-value">${payload.data.workflowName}</span></div>` : ''}
        ${payload.data.executionId ? `<div class="details-row"><span class="details-label">Execution ID:</span><span class="details-value">${payload.data.executionId}</span></div>` : ''}
        ${payload.data.timestamp ? `<div class="details-row"><span class="details-label">Time:</span><span class="details-value">${payload.data.timestamp}</span></div>` : ''}
        ${payload.data.errorMessage ? `<div class="details-row"><span class="details-label">Error:</span><span class="details-value">${payload.data.errorMessage}</span></div>` : ''}
      </div>
      ` : ''}
      ${payload.links ? `
      <div style="margin-top: 20px;">
        ${payload.links.execution ? `<a href="${payload.links.execution}" class="button">View Execution</a>` : ''}
        ${payload.links.workflow ? `<a href="${payload.links.workflow}" class="button">View Workflow</a>` : ''}
      </div>
      ` : ''}
    </div>
    <div class="footer">
      Sent by AgentSmith Automation Platform
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Find matching notification rules
   */
  private findMatchingRules(payload: NotificationPayload, workspaceId?: string): NotificationRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      if (workspaceId && rule.workspaceId && rule.workspaceId !== workspaceId) return false;

      // Check trigger type
      if (rule.trigger.type !== payload.type && rule.trigger.type !== 'custom') return false;

      // Check workflow filter
      if (rule.trigger.workflowIds?.length && payload.data?.workflowId) {
        if (!rule.trigger.workflowIds.includes(payload.data.workflowId)) return false;
      }

      // Check conditions
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, payload)) return false;
      }

      return true;
    });
  }

  /**
   * Evaluate a notification condition
   */
  private evaluateCondition(condition: NotificationCondition, payload: NotificationPayload): boolean {
    const value = payload.data?.[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(condition.value);
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return true;
    }
  }

  /**
   * Check if rule is within active schedule
   */
  private isWithinSchedule(rule: NotificationRule): boolean {
    if (!rule.schedule) return true;

    const now = new Date();
    const tz = rule.schedule.timezone || 'UTC';

    // Check active days
    if (rule.schedule.activeDays?.length) {
      const day = now.getDay();
      if (!rule.schedule.activeDays.includes(day)) return false;
    }

    // Check active hours
    if (rule.schedule.activeHours) {
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const current = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      if (current < rule.schedule.activeHours.start || current > rule.schedule.activeHours.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if rule is throttled
   */
  private isThrottled(rule: NotificationRule): boolean {
    if (!rule.throttle) return false;

    const key = `throttle:${rule.id}`;
    const tracker = this.throttleTracker.get(key);

    if (!tracker) return false;

    const windowMs = rule.throttle.windowMinutes * 60 * 1000;
    const windowEnd = new Date(tracker.windowStart.getTime() + windowMs);

    if (new Date() > windowEnd) {
      // Window expired, reset
      this.throttleTracker.delete(key);
      return false;
    }

    return tracker.count >= rule.throttle.count;
  }

  /**
   * Update throttle counter
   */
  private updateThrottle(rule: NotificationRule): void {
    if (!rule.throttle) return;

    const key = `throttle:${rule.id}`;
    const tracker = this.throttleTracker.get(key);

    if (tracker) {
      tracker.count++;
    } else {
      this.throttleTracker.set(key, { count: 1, windowStart: new Date() });
    }
  }

  /**
   * Test a notification channel
   */
  async testChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    const testPayload: NotificationPayload = {
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test notification from AgentSmith.',
      severity: 'info',
      data: {
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.sendToChannel(channel, testPayload);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const notificationService = new NotificationService();

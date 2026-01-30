// @ts-nocheck
/**
 * Log Streaming Service
 *
 * Enterprise feature for streaming logs to external services:
 * - Datadog
 * - Splunk
 * - Elasticsearch
 * - Loki
 * - Custom HTTP endpoints
 * - Amazon CloudWatch
 * - Azure Monitor
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type LogDestination =
  | 'datadog'
  | 'splunk'
  | 'elasticsearch'
  | 'loki'
  | 'cloudwatch'
  | 'azure'
  | 'http';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogStreamConfig {
  destination: LogDestination;
  enabled: boolean;
  // Common settings
  batchSize?: number;
  flushIntervalMs?: number;
  // Datadog
  datadog?: {
    apiKey: string;
    site?: string;
    service?: string;
    source?: string;
    tags?: string[];
  };
  // Splunk
  splunk?: {
    hecUrl: string;
    hecToken: string;
    index?: string;
    source?: string;
    sourcetype?: string;
  };
  // Elasticsearch
  elasticsearch?: {
    url: string;
    username?: string;
    password?: string;
    apiKey?: string;
    index: string;
    pipeline?: string;
  };
  // Loki
  loki?: {
    url: string;
    username?: string;
    password?: string;
    tenantId?: string;
    labels?: Record<string, string>;
  };
  // CloudWatch
  cloudwatch?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    logGroupName: string;
    logStreamName?: string;
  };
  // Azure Monitor
  azure?: {
    workspaceId: string;
    sharedKey: string;
    logType: string;
  };
  // Custom HTTP
  http?: {
    url: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    authToken?: string;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  workflowId?: string;
  executionId?: string;
  nodeId?: string;
}

interface BatchedLog {
  entries: LogEntry[];
  destination: LogDestination;
}

// ============================================================================
// LOG STREAMING SERVICE
// ============================================================================

class LogStreamingService {
  private configs: Map<string, LogStreamConfig> = new Map();
  private buffer: Map<string, LogEntry[]> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private isInitialized = false;
  private defaultBatchSize = 100;
  private defaultFlushInterval = 5000;

  /**
   * Add a log streaming destination
   */
  async addDestination(id: string, config: LogStreamConfig): Promise<void> {
    if (!config.enabled) {
      logger.info('Log streaming destination disabled', { id, destination: config.destination });
      return;
    }

    // Initialize client based on destination
    const client = await this.createClient(config);
    if (client) {
      this.clients.set(id, client);
    }

    this.configs.set(id, {
      batchSize: this.defaultBatchSize,
      flushIntervalMs: this.defaultFlushInterval,
      ...config,
    });

    this.buffer.set(id, []);

    // Start flush timer
    this.startFlushTimer(id);

    this.isInitialized = true;
    logger.info('Log streaming destination configured', {
      id,
      destination: config.destination,
    });
  }

  /**
   * Remove a log streaming destination
   */
  removeDestination(id: string): void {
    const timer = this.flushTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.flushTimers.delete(id);
    }

    // Flush remaining logs
    this.flush(id);

    this.configs.delete(id);
    this.buffer.delete(id);
    this.clients.delete(id);

    logger.info('Log streaming destination removed', { id });
  }

  /**
   * Send a log entry to all configured destinations
   */
  async log(entry: LogEntry): Promise<void> {
    if (!this.isInitialized) return;

    for (const [id, config] of this.configs) {
      if (!config.enabled) continue;

      const buffer = this.buffer.get(id) || [];
      buffer.push(entry);
      this.buffer.set(id, buffer);

      // Flush if buffer is full
      if (buffer.length >= (config.batchSize || this.defaultBatchSize)) {
        await this.flush(id);
      }
    }
  }

  /**
   * Log with level shortcuts
   */
  async debug(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ timestamp: new Date(), level: 'debug', message, context });
  }

  async info(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ timestamp: new Date(), level: 'info', message, context });
  }

  async warn(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ timestamp: new Date(), level: 'warn', message, context });
  }

  async error(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ timestamp: new Date(), level: 'error', message, context });
  }

  /**
   * Flush logs for a specific destination
   */
  async flush(id: string): Promise<void> {
    const buffer = this.buffer.get(id);
    const config = this.configs.get(id);

    if (!buffer || !config || buffer.length === 0) return;

    // Clear buffer
    const entries = [...buffer];
    this.buffer.set(id, []);

    try {
      switch (config.destination) {
        case 'datadog':
          await this.sendToDatadog(config, entries);
          break;
        case 'splunk':
          await this.sendToSplunk(config, entries);
          break;
        case 'elasticsearch':
          await this.sendToElasticsearch(config, entries);
          break;
        case 'loki':
          await this.sendToLoki(config, entries);
          break;
        case 'cloudwatch':
          await this.sendToCloudWatch(config, entries);
          break;
        case 'azure':
          await this.sendToAzure(config, entries);
          break;
        case 'http':
          await this.sendToHttp(config, entries);
          break;
      }
    } catch (error) {
      logger.error('Failed to stream logs', {
        destination: config.destination,
        error: error instanceof Error ? error.message : 'Unknown error',
        entriesLost: entries.length,
      });
    }
  }

  /**
   * Flush all destinations
   */
  async flushAll(): Promise<void> {
    const promises = Array.from(this.configs.keys()).map((id) => this.flush(id));
    await Promise.all(promises);
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    this.flushTimers.clear();

    // Flush remaining logs
    await this.flushAll();

    this.isInitialized = false;
    logger.info('Log streaming service shut down');
  }

  // ============================================================================
  // DESTINATION IMPLEMENTATIONS
  // ============================================================================

  private async createClient(config: LogStreamConfig): Promise<AxiosInstance | null> {
    switch (config.destination) {
      case 'datadog':
        return axios.create({
          baseURL: `https://http-intake.logs.${config.datadog?.site || 'datadoghq.com'}`,
          headers: {
            'DD-API-KEY': config.datadog?.apiKey || '',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

      case 'splunk':
        return axios.create({
          baseURL: config.splunk?.hecUrl,
          headers: {
            Authorization: `Splunk ${config.splunk?.hecToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

      case 'elasticsearch':
        const esHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.elasticsearch?.apiKey) {
          esHeaders['Authorization'] = `ApiKey ${config.elasticsearch.apiKey}`;
        }
        return axios.create({
          baseURL: config.elasticsearch?.url,
          headers: esHeaders,
          auth: config.elasticsearch?.username ? {
            username: config.elasticsearch.username,
            password: config.elasticsearch.password || '',
          } : undefined,
          timeout: 10000,
        });

      case 'loki':
        const lokiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.loki?.tenantId) {
          lokiHeaders['X-Scope-OrgID'] = config.loki.tenantId;
        }
        return axios.create({
          baseURL: config.loki?.url,
          headers: lokiHeaders,
          auth: config.loki?.username ? {
            username: config.loki.username,
            password: config.loki.password || '',
          } : undefined,
          timeout: 10000,
        });

      case 'http':
        const httpHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...config.http?.headers,
        };
        if (config.http?.authToken) {
          httpHeaders['Authorization'] = `Bearer ${config.http.authToken}`;
        }
        return axios.create({
          headers: httpHeaders,
          timeout: 10000,
        });

      default:
        return null;
    }
  }

  private async sendToDatadog(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const client = this.clients.get(this.getConfigId(config));
    if (!client) return;

    const logs = entries.map((entry) => ({
      ddsource: config.datadog?.source || 'agentsmith',
      ddtags: config.datadog?.tags?.join(',') || '',
      hostname: process.env.HOSTNAME || 'agentsmith',
      service: config.datadog?.service || 'agentsmith',
      status: entry.level,
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      ...entry.context,
      trace_id: entry.traceId,
      span_id: entry.spanId,
      user_id: entry.userId,
      workflow_id: entry.workflowId,
      execution_id: entry.executionId,
    }));

    await client.post('/api/v2/logs', logs);
  }

  private async sendToSplunk(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const client = this.clients.get(this.getConfigId(config));
    if (!client) return;

    const events = entries.map((entry) => ({
      event: {
        level: entry.level,
        message: entry.message,
        ...entry.context,
        traceId: entry.traceId,
        userId: entry.userId,
        workflowId: entry.workflowId,
        executionId: entry.executionId,
      },
      time: entry.timestamp.getTime() / 1000,
      source: config.splunk?.source || 'agentsmith',
      sourcetype: config.splunk?.sourcetype || '_json',
      index: config.splunk?.index,
    }));

    // Splunk HEC accepts newline-delimited JSON
    const body = events.map((e) => JSON.stringify(e)).join('\n');
    await client.post('/services/collector/event', body);
  }

  private async sendToElasticsearch(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const client = this.clients.get(this.getConfigId(config));
    if (!client) return;

    const index = config.elasticsearch?.index || 'agentsmith-logs';
    const pipeline = config.elasticsearch?.pipeline;

    // Use bulk API
    const body = entries.flatMap((entry) => [
      { index: { _index: `${index}-${entry.timestamp.toISOString().split('T')[0]}` } },
      {
        '@timestamp': entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        ...entry.context,
        trace: { id: entry.traceId },
        user: { id: entry.userId },
        workflow: { id: entry.workflowId },
        execution: { id: entry.executionId },
      },
    ]);

    const url = pipeline ? `/_bulk?pipeline=${pipeline}` : '/_bulk';
    await client.post(url, body.map((b) => JSON.stringify(b)).join('\n') + '\n', {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  private async sendToLoki(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const client = this.clients.get(this.getConfigId(config));
    if (!client) return;

    const labels = {
      app: 'agentsmith',
      ...config.loki?.labels,
    };

    const streams = entries.map((entry) => ({
      stream: {
        ...labels,
        level: entry.level,
        ...(entry.workflowId && { workflow_id: entry.workflowId }),
      },
      values: [
        [
          (entry.timestamp.getTime() * 1000000).toString(), // nanoseconds
          JSON.stringify({
            message: entry.message,
            ...entry.context,
            traceId: entry.traceId,
            userId: entry.userId,
            executionId: entry.executionId,
          }),
        ],
      ],
    }));

    await client.post('/loki/api/v1/push', { streams });
  }

  private async sendToCloudWatch(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const cw = config.cloudwatch;
    if (!cw) return;

    // CloudWatch Logs API requires AWS Signature v4
    // This is a simplified implementation
    const logEvents = entries.map((entry) => ({
      timestamp: entry.timestamp.getTime(),
      message: JSON.stringify({
        level: entry.level,
        message: entry.message,
        ...entry.context,
        traceId: entry.traceId,
        userId: entry.userId,
        workflowId: entry.workflowId,
        executionId: entry.executionId,
      }),
    }));

    const host = `logs.${cw.region}.amazonaws.com`;
    const body = JSON.stringify({
      logGroupName: cw.logGroupName,
      logStreamName: cw.logStreamName || `agentsmith-${new Date().toISOString().split('T')[0]}`,
      logEvents,
    });

    // In production, use proper AWS SDK or signature
    await axios.post(`https://${host}`, body, {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'Logs_20140328.PutLogEvents',
      },
      timeout: 10000,
    });
  }

  private async sendToAzure(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const azure = config.azure;
    if (!azure) return;

    const body = entries.map((entry) => ({
      TimeGenerated: entry.timestamp.toISOString(),
      Level: entry.level,
      Message: entry.message,
      ...entry.context,
      TraceId: entry.traceId,
      UserId: entry.userId,
      WorkflowId: entry.workflowId,
      ExecutionId: entry.executionId,
    }));

    const date = new Date().toUTCString();
    const stringToSign = `POST\n${JSON.stringify(body).length}\napplication/json\nx-ms-date:${date}\n/api/logs`;

    // Create signature
    const signature = this.createAzureSignature(stringToSign, azure.sharedKey);

    await axios.post(
      `https://${azure.workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Log-Type': azure.logType,
          'x-ms-date': date,
          Authorization: `SharedKey ${azure.workspaceId}:${signature}`,
        },
        timeout: 10000,
      }
    );
  }

  private async sendToHttp(config: LogStreamConfig, entries: LogEntry[]): Promise<void> {
    const http = config.http;
    if (!http) return;

    const client = this.clients.get(this.getConfigId(config));
    if (!client) return;

    const method = http.method || 'POST';
    await client.request({
      method,
      url: http.url,
      data: entries,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private startFlushTimer(id: string): void {
    const config = this.configs.get(id);
    if (!config) return;

    const interval = config.flushIntervalMs || this.defaultFlushInterval;

    const timer = setInterval(() => {
      this.flush(id).catch((err) => {
        logger.error('Flush timer error', { id, error: err.message });
      });
    }, interval);

    this.flushTimers.set(id, timer);
  }

  private getConfigId(config: LogStreamConfig): string {
    for (const [id, c] of this.configs) {
      if (c === config) return id;
    }
    return '';
  }

  private createAzureSignature(stringToSign: string, sharedKey: string): string {
    const crypto = require('crypto');
    const key = Buffer.from(sharedKey, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(stringToSign, 'utf-8');
    return hmac.digest('base64');
  }
}

// Export singleton instance
export const logStreamingService = new LogStreamingService();

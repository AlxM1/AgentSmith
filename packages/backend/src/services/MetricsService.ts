// @ts-nocheck
/**
 * Prometheus Metrics Service
 *
 * Exposes application metrics in Prometheus format:
 * - Workflow execution metrics
 * - Queue metrics
 * - System metrics
 * - Custom business metrics
 */

import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricLabels {
  [key: string]: string | number;
}

export interface CounterMetric {
  name: string;
  help: string;
  type: 'counter';
  labels: string[];
  values: Map<string, number>;
}

export interface GaugeMetric {
  name: string;
  help: string;
  type: 'gauge';
  labels: string[];
  values: Map<string, number>;
}

export interface HistogramMetric {
  name: string;
  help: string;
  type: 'histogram';
  labels: string[];
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: Map<number, number> }>;
}

export interface SummaryMetric {
  name: string;
  help: string;
  type: 'summary';
  labels: string[];
  quantiles: number[];
  values: Map<string, { count: number; sum: number; samples: number[] }>;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;

// ============================================================================
// METRICS SERVICE
// ============================================================================

class MetricsService {
  private metrics: Map<string, Metric> = new Map();
  private defaultLabels: MetricLabels = {};
  private prefix: string = 'agentsmith';

  constructor() {
    this.initializeDefaultMetrics();
  }

  /**
   * Set default labels for all metrics
   */
  setDefaultLabels(labels: MetricLabels): void {
    this.defaultLabels = labels;
  }

  /**
   * Set metric prefix
   */
  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  // ============================================================================
  // METRIC CREATION
  // ============================================================================

  /**
   * Create a counter metric
   */
  createCounter(name: string, help: string, labels: string[] = []): void {
    const fullName = `${this.prefix}_${name}`;
    if (this.metrics.has(fullName)) return;

    this.metrics.set(fullName, {
      name: fullName,
      help,
      type: 'counter',
      labels,
      values: new Map(),
    });
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, help: string, labels: string[] = []): void {
    const fullName = `${this.prefix}_${name}`;
    if (this.metrics.has(fullName)) return;

    this.metrics.set(fullName, {
      name: fullName,
      help,
      type: 'gauge',
      labels,
      values: new Map(),
    });
  }

  /**
   * Create a histogram metric
   */
  createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ): void {
    const fullName = `${this.prefix}_${name}`;
    if (this.metrics.has(fullName)) return;

    this.metrics.set(fullName, {
      name: fullName,
      help,
      type: 'histogram',
      labels,
      buckets: buckets.sort((a, b) => a - b),
      values: new Map(),
    });
  }

  /**
   * Create a summary metric
   */
  createSummary(
    name: string,
    help: string,
    labels: string[] = [],
    quantiles: number[] = [0.5, 0.9, 0.99]
  ): void {
    const fullName = `${this.prefix}_${name}`;
    if (this.metrics.has(fullName)) return;

    this.metrics.set(fullName, {
      name: fullName,
      help,
      type: 'summary',
      labels,
      quantiles,
      values: new Map(),
    });
  }

  // ============================================================================
  // METRIC OPERATIONS
  // ============================================================================

  /**
   * Increment counter
   */
  incCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const fullName = `${this.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as CounterMetric;
    if (!metric || metric.type !== 'counter') return;

    const key = this.labelsToKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const fullName = `${this.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as GaugeMetric;
    if (!metric || metric.type !== 'gauge') return;

    const key = this.labelsToKey(labels);
    metric.values.set(key, value);
  }

  /**
   * Increment gauge
   */
  incGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const fullName = `${this.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as GaugeMetric;
    if (!metric || metric.type !== 'gauge') return;

    const key = this.labelsToKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Decrement gauge
   */
  decGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    this.incGauge(name, labels, -value);
  }

  /**
   * Observe histogram value
   */
  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    const fullName = `${this.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as HistogramMetric;
    if (!metric || metric.type !== 'histogram') return;

    const key = this.labelsToKey(labels);
    let data = metric.values.get(key);

    if (!data) {
      data = {
        count: 0,
        sum: 0,
        buckets: new Map(metric.buckets.map((b) => [b, 0])),
      };
      metric.values.set(key, data);
    }

    data.count++;
    data.sum += value;

    for (const bucket of metric.buckets) {
      if (value <= bucket) {
        data.buckets.set(bucket, (data.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  /**
   * Time a function and observe duration
   */
  async timeHistogram<T>(
    name: string,
    fn: () => Promise<T>,
    labels: MetricLabels = {}
  ): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      return await fn();
    } finally {
      const end = process.hrtime.bigint();
      const durationSeconds = Number(end - start) / 1e9;
      this.observeHistogram(name, durationSeconds, labels);
    }
  }

  /**
   * Observe summary value
   */
  observeSummary(name: string, value: number, labels: MetricLabels = {}): void {
    const fullName = `${this.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as SummaryMetric;
    if (!metric || metric.type !== 'summary') return;

    const key = this.labelsToKey(labels);
    let data = metric.values.get(key);

    if (!data) {
      data = { count: 0, sum: 0, samples: [] };
      metric.values.set(key, data);
    }

    data.count++;
    data.sum += value;
    data.samples.push(value);

    // Keep only last 1000 samples
    if (data.samples.length > 1000) {
      data.samples = data.samples.slice(-1000);
    }
  }

  // ============================================================================
  // PROMETHEUS OUTPUT
  // ============================================================================

  /**
   * Generate Prometheus format output
   */
  generatePrometheusOutput(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      switch (metric.type) {
        case 'counter':
        case 'gauge':
          for (const [key, value] of metric.values) {
            const labelStr = this.keyToLabelString(key);
            lines.push(`${metric.name}${labelStr} ${value}`);
          }
          break;

        case 'histogram':
          for (const [key, data] of metric.values) {
            const labels = this.keyToLabels(key);
            const labelStr = this.keyToLabelString(key);

            for (const [bucket, count] of data.buckets) {
              const bucketLabels = { ...labels, le: bucket.toString() };
              lines.push(`${metric.name}_bucket${this.labelsToLabelString(bucketLabels)} ${count}`);
            }

            const infLabels = { ...labels, le: '+Inf' };
            lines.push(`${metric.name}_bucket${this.labelsToLabelString(infLabels)} ${data.count}`);
            lines.push(`${metric.name}_sum${labelStr} ${data.sum}`);
            lines.push(`${metric.name}_count${labelStr} ${data.count}`);
          }
          break;

        case 'summary':
          for (const [key, data] of metric.values) {
            const labels = this.keyToLabels(key);
            const labelStr = this.keyToLabelString(key);

            // Calculate quantiles
            const sorted = [...data.samples].sort((a, b) => a - b);
            for (const q of (metric as SummaryMetric).quantiles) {
              const idx = Math.ceil(q * sorted.length) - 1;
              const value = sorted[Math.max(0, idx)] || 0;
              const quantileLabels = { ...labels, quantile: q.toString() };
              lines.push(`${metric.name}${this.labelsToLabelString(quantileLabels)} ${value}`);
            }

            lines.push(`${metric.name}_sum${labelStr} ${data.sum}`);
            lines.push(`${metric.name}_count${labelStr} ${data.count}`);
          }
          break;
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJson(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const metric of this.metrics.values()) {
      const values: any[] = [];

      switch (metric.type) {
        case 'counter':
        case 'gauge':
          for (const [key, value] of metric.values) {
            values.push({
              labels: this.keyToLabels(key),
              value,
            });
          }
          break;

        case 'histogram':
          for (const [key, data] of metric.values) {
            values.push({
              labels: this.keyToLabels(key),
              count: data.count,
              sum: data.sum,
              buckets: Object.fromEntries(data.buckets),
            });
          }
          break;

        case 'summary':
          for (const [key, data] of metric.values) {
            values.push({
              labels: this.keyToLabels(key),
              count: data.count,
              sum: data.sum,
            });
          }
          break;
      }

      result[metric.name] = {
        type: metric.type,
        help: metric.help,
        values,
      };
    }

    return result;
  }

  // ============================================================================
  // DEFAULT METRICS
  // ============================================================================

  private initializeDefaultMetrics(): void {
    // Workflow metrics
    this.createCounter('workflow_executions_total', 'Total number of workflow executions', [
      'workflow_id',
      'status',
      'mode',
    ]);
    this.createHistogram(
      'workflow_execution_duration_seconds',
      'Workflow execution duration in seconds',
      ['workflow_id', 'status'],
      [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
    );
    this.createGauge('workflow_active_executions', 'Number of currently active executions', [
      'workflow_id',
    ]);
    this.createGauge('workflows_total', 'Total number of workflows', ['status']);

    // Queue metrics
    this.createGauge('queue_jobs_waiting', 'Number of jobs waiting in queue', ['queue']);
    this.createGauge('queue_jobs_active', 'Number of active jobs', ['queue']);
    this.createGauge('queue_jobs_completed', 'Number of completed jobs', ['queue']);
    this.createGauge('queue_jobs_failed', 'Number of failed jobs', ['queue']);
    this.createGauge('queue_jobs_delayed', 'Number of delayed jobs', ['queue']);

    // Node metrics
    this.createCounter('node_executions_total', 'Total number of node executions', [
      'node_type',
      'status',
    ]);
    this.createHistogram(
      'node_execution_duration_seconds',
      'Node execution duration in seconds',
      ['node_type'],
      [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    );

    // HTTP metrics
    this.createCounter('http_requests_total', 'Total number of HTTP requests', [
      'method',
      'path',
      'status',
    ]);
    this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'path'],
      [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    );

    // System metrics
    this.createGauge('nodejs_heap_size_bytes', 'Node.js heap size in bytes', ['type']);
    this.createGauge('nodejs_external_memory_bytes', 'Node.js external memory in bytes', []);
    this.createGauge('process_cpu_usage', 'Process CPU usage', []);
    this.createGauge('process_memory_usage_bytes', 'Process memory usage in bytes', ['type']);

    // Credential metrics
    this.createGauge('credentials_total', 'Total number of credentials', ['type']);

    // User metrics
    this.createGauge('users_total', 'Total number of users', ['role', 'status']);
    this.createCounter('user_logins_total', 'Total number of user logins', ['method']);

    // Webhook metrics
    this.createCounter('webhook_requests_total', 'Total number of webhook requests', [
      'workflow_id',
      'status',
    ]);
    this.createHistogram(
      'webhook_response_time_seconds',
      'Webhook response time in seconds',
      ['workflow_id'],
      [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
    );

    // Error metrics
    this.createCounter('errors_total', 'Total number of errors', ['type', 'code']);

    logger.debug('Default metrics initialized');
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();

    this.setGauge('nodejs_heap_size_bytes', memUsage.heapTotal, { type: 'total' });
    this.setGauge('nodejs_heap_size_bytes', memUsage.heapUsed, { type: 'used' });
    this.setGauge('nodejs_external_memory_bytes', memUsage.external);
    this.setGauge('process_memory_usage_bytes', memUsage.rss, { type: 'rss' });
    this.setGauge('process_memory_usage_bytes', memUsage.heapUsed, { type: 'heap' });

    // CPU usage
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    this.setGauge('process_cpu_usage', totalCpuTime / 1000000); // Convert to seconds
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private labelsToKey(labels: MetricLabels): string {
    const combined = { ...this.defaultLabels, ...labels };
    return JSON.stringify(
      Object.keys(combined)
        .sort()
        .map((k) => [k, combined[k]])
    );
  }

  private keyToLabels(key: string): MetricLabels {
    try {
      const pairs = JSON.parse(key) as [string, string | number][];
      return Object.fromEntries(pairs);
    } catch {
      return {};
    }
  }

  private keyToLabelString(key: string): string {
    const labels = this.keyToLabels(key);
    return this.labelsToLabelString(labels);
  }

  private labelsToLabelString(labels: MetricLabels): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';

    const parts = entries.map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
    return `{${parts.join(',')}}`;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.values.clear();
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Start system metrics collection
setInterval(() => metricsService.updateSystemMetrics(), 15000);

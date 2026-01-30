/**
 * OpenTelemetry Distributed Tracing
 * Provides request tracing across services for debugging and observability
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Context,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { Request, Response, NextFunction } from 'express';

// Configuration
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'agentsmith-backend';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTracing(): void {
  if (!OTEL_ENABLED) {
    console.log('OpenTelemetry tracing is disabled');
    return;
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
  });

  // Configure metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${OTEL_ENDPOINT}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export every minute
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Customize which instrumentations to enable
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            // Ignore health checks
            return req.url?.includes('/health') || req.url?.includes('/metrics');
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
      }),
    ],
    textMapPropagator: new W3CTraceContextPropagator(),
  });

  sdk.start();
  console.log(`OpenTelemetry tracing initialized for ${SERVICE_NAME}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error));
  });
}

/**
 * Shutdown tracing
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log('Tracing shut down');
  }
}

/**
 * Get the tracer instance
 */
export function getTracer(name?: string): Tracer {
  return trace.getTracer(name || SERVICE_NAME, SERVICE_VERSION);
}

/**
 * Create a new span
 */
export function createSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parentContext?: Context;
  }
): Span {
  const tracer = getTracer();
  const ctx = options?.parentContext || context.active();

  return tracer.startSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    },
    ctx
  );
}

/**
 * Execute a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const span = createSpan(name, options);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: any) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Express middleware for request tracing
 */
export function tracingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip health checks and metrics
    if (req.path.includes('/health') || req.path.includes('/metrics')) {
      return next();
    }

    const tracer = getTracer();
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.get('user-agent') || 'unknown',
        'http.request_id': req.headers['x-request-id'] as string || 'unknown',
      },
    });

    // Add trace context to response headers
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Span-Id', spanId);

    // Store span in request for later use
    (req as any).span = span;

    // Capture response
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': res.get('content-length') || 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalEnd.apply(this, args);
    };

    // Execute with context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception in the current span
 */
export function recordException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Get current trace ID
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

/**
 * Get current span ID
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().spanId;
}

/**
 * Decorator for tracing methods
 */
export function Trace(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const spanName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return withSpan(spanName, async (span) => {
        span.setAttribute('method.name', propertyKey);
        span.setAttribute('method.class', target.constructor.name);
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Workflow execution tracing
 */
export function traceWorkflowExecution(
  workflowId: string,
  executionId: string,
  nodeName?: string
): Span {
  return createSpan(`workflow.execute.${nodeName || 'main'}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'workflow.id': workflowId,
      'execution.id': executionId,
      'node.name': nodeName || 'main',
    },
  });
}

/**
 * Database query tracing
 */
export async function traceDbQuery<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`db.${operation}`, async (span) => {
    span.setAttributes({
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.sql.table': table,
    });
    return fn();
  }, { kind: SpanKind.CLIENT });
}

/**
 * External API call tracing
 */
export async function traceExternalCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`external.${service}.${operation}`, async (span) => {
    span.setAttributes({
      'external.service': service,
      'external.operation': operation,
    });
    return fn();
  }, { kind: SpanKind.CLIENT });
}

export default {
  initTracing,
  shutdownTracing,
  getTracer,
  createSpan,
  withSpan,
  tracingMiddleware,
  addSpanAttributes,
  addSpanEvent,
  recordException,
  getCurrentTraceId,
  getCurrentSpanId,
};

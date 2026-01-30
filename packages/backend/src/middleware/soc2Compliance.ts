// @ts-nocheck
/**
 * SOC 2 Compliance Middleware
 *
 * Implements controls for SOC 2 Type II compliance:
 * - Comprehensive audit logging
 * - Access control verification
 * - Data encryption validation
 * - Session management
 * - Security event monitoring
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode?: number;
  requestBody?: Record<string, any>;
  responseTime?: number;
  outcome: 'success' | 'failure' | 'error';
  errorMessage?: string;
  metadata?: Record<string, any>;
  // SOC 2 specific fields
  controlId?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface ComplianceConfig {
  enabled: boolean;
  logAllRequests: boolean;
  logRequestBody: boolean;
  logResponseBody: boolean;
  sensitiveFields: string[];
  excludePaths: string[];
  retentionDays: number;
  alertOnHighRisk: boolean;
  requireEncryption: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ComplianceConfig = {
  enabled: true,
  logAllRequests: true,
  logRequestBody: true,
  logResponseBody: false,
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'credential',
    'private_key',
    'privateKey',
  ],
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  retentionDays: 365, // SOC 2 requires minimum 1 year retention
  alertOnHighRisk: true,
  requireEncryption: true,
};

// ============================================================================
// SOC 2 CONTROL MAPPINGS
// ============================================================================

const CONTROL_MAPPINGS: Record<string, { controlId: string; name: string; riskLevel: string }> = {
  // CC6.1 - Logical and Physical Access Controls
  'auth:login': { controlId: 'CC6.1', name: 'User Authentication', riskLevel: 'high' },
  'auth:logout': { controlId: 'CC6.1', name: 'User Logout', riskLevel: 'low' },
  'auth:register': { controlId: 'CC6.1', name: 'User Registration', riskLevel: 'high' },
  'auth:password-change': { controlId: 'CC6.1', name: 'Password Change', riskLevel: 'high' },
  'auth:2fa-enable': { controlId: 'CC6.1', name: '2FA Enablement', riskLevel: 'medium' },
  'auth:2fa-disable': { controlId: 'CC6.1', name: '2FA Disablement', riskLevel: 'high' },

  // CC6.2 - Prior to Issuing System Credentials
  'user:create': { controlId: 'CC6.2', name: 'User Creation', riskLevel: 'high' },
  'user:delete': { controlId: 'CC6.2', name: 'User Deletion', riskLevel: 'high' },
  'user:role-change': { controlId: 'CC6.2', name: 'Role Assignment', riskLevel: 'critical' },

  // CC6.3 - Authorization of Information Access
  'workflow:create': { controlId: 'CC6.3', name: 'Workflow Creation', riskLevel: 'medium' },
  'workflow:update': { controlId: 'CC6.3', name: 'Workflow Update', riskLevel: 'medium' },
  'workflow:delete': { controlId: 'CC6.3', name: 'Workflow Deletion', riskLevel: 'high' },
  'workflow:execute': { controlId: 'CC6.3', name: 'Workflow Execution', riskLevel: 'medium' },
  'workflow:share': { controlId: 'CC6.3', name: 'Workflow Sharing', riskLevel: 'high' },

  // CC6.6 - Encryption
  'credential:create': { controlId: 'CC6.6', name: 'Credential Creation', riskLevel: 'high' },
  'credential:update': { controlId: 'CC6.6', name: 'Credential Update', riskLevel: 'high' },
  'credential:delete': { controlId: 'CC6.6', name: 'Credential Deletion', riskLevel: 'high' },
  'credential:access': { controlId: 'CC6.6', name: 'Credential Access', riskLevel: 'high' },

  // CC7.2 - Monitoring
  'admin:settings': { controlId: 'CC7.2', name: 'Admin Settings Change', riskLevel: 'critical' },
  'admin:backup': { controlId: 'CC7.2', name: 'Backup Operation', riskLevel: 'high' },
  'admin:restore': { controlId: 'CC7.2', name: 'Restore Operation', riskLevel: 'critical' },

  // CC8.1 - Change Management
  'environment:promote': { controlId: 'CC8.1', name: 'Environment Promotion', riskLevel: 'high' },
  'environment:rollback': { controlId: 'CC8.1', name: 'Environment Rollback', riskLevel: 'high' },
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create audit log entry
 */
async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const id = `audit_${crypto.randomUUID()}`;

  try {
    await db.insert(auditLogs).values({
      id,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resource,
      resourceId: entry.resourceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: {
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        responseTime: entry.responseTime,
        outcome: entry.outcome,
        errorMessage: entry.errorMessage,
        controlId: entry.controlId,
        riskLevel: entry.riskLevel,
        dataClassification: entry.dataClassification,
        ...entry.metadata,
      },
      createdAt: new Date(),
    });

    // Log high-risk events
    if (entry.riskLevel === 'critical' || entry.riskLevel === 'high') {
      logger.warn('SOC2 High-Risk Event', {
        action: entry.action,
        userId: entry.userId,
        controlId: entry.controlId,
        outcome: entry.outcome,
      });
    }
  } catch (error) {
    logger.error('Failed to create audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entry,
    });
  }
}

// ============================================================================
// DATA SANITIZATION
// ============================================================================

/**
 * Redact sensitive fields from object
 */
function redactSensitiveData(
  data: any,
  sensitiveFields: string[],
  depth: number = 0
): any {
  if (depth > 10) return data; // Prevent infinite recursion

  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, sensitiveFields, depth + 1));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some((field) =>
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value, sensitiveFields, depth + 1);
      }
    }

    return redacted;
  }

  return data;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * SOC 2 Compliance Audit Middleware
 */
export function soc2AuditMiddleware(config: Partial<ComplianceConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.enabled) {
      return next();
    }

    // Skip excluded paths
    if (cfg.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Extract user info if available
    const user = (req as any).user;
    const userId = user?.id;
    const userEmail = user?.email;

    // Determine action and control mapping
    const action = determineAction(req);
    const control = CONTROL_MAPPINGS[action] || {
      controlId: 'CC7.2',
      name: 'General Access',
      riskLevel: 'low',
    };

    // Capture original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody: any;

    res.json = (body: any) => {
      responseBody = body;
      return originalJson(body);
    };

    res.send = (body: any) => {
      if (!responseBody) responseBody = body;
      return originalSend(body);
    };

    // Log on response finish
    res.on('finish', async () => {
      const responseTime = Date.now() - startTime;
      const outcome = res.statusCode < 400 ? 'success' : res.statusCode < 500 ? 'failure' : 'error';

      const entry: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
        userId,
        userEmail,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || 'unknown',
        action,
        resource: getResourceType(req),
        resourceId: getResourceId(req),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        outcome,
        controlId: control.controlId,
        riskLevel: control.riskLevel as any,
        metadata: {
          requestId,
          query: req.query,
        },
      };

      // Include request body if configured
      if (cfg.logRequestBody && req.body && Object.keys(req.body).length > 0) {
        entry.requestBody = redactSensitiveData(req.body, cfg.sensitiveFields);
      }

      // Capture error messages
      if (outcome === 'error' && responseBody?.error) {
        entry.errorMessage = responseBody.error;
      }

      await createAuditLog(entry);
    });

    next();
  };
}

/**
 * Determine action from request
 */
function determineAction(req: Request): string {
  const path = req.path;
  const method = req.method;

  // Authentication actions
  if (path.includes('/auth/login')) return 'auth:login';
  if (path.includes('/auth/logout')) return 'auth:logout';
  if (path.includes('/auth/register')) return 'auth:register';
  if (path.includes('/auth/password')) return 'auth:password-change';
  if (path.includes('/2fa') && method === 'POST') return 'auth:2fa-enable';
  if (path.includes('/2fa') && method === 'DELETE') return 'auth:2fa-disable';

  // User actions
  if (path.includes('/users') && method === 'POST') return 'user:create';
  if (path.includes('/users') && method === 'DELETE') return 'user:delete';
  if (path.includes('/users') && path.includes('/role')) return 'user:role-change';

  // Workflow actions
  if (path.includes('/workflows') && method === 'POST') return 'workflow:create';
  if (path.includes('/workflows') && method === 'PUT') return 'workflow:update';
  if (path.includes('/workflows') && method === 'PATCH') return 'workflow:update';
  if (path.includes('/workflows') && method === 'DELETE') return 'workflow:delete';
  if (path.includes('/execute')) return 'workflow:execute';
  if (path.includes('/share')) return 'workflow:share';

  // Credential actions
  if (path.includes('/credentials') && method === 'POST') return 'credential:create';
  if (path.includes('/credentials') && method === 'PUT') return 'credential:update';
  if (path.includes('/credentials') && method === 'PATCH') return 'credential:update';
  if (path.includes('/credentials') && method === 'DELETE') return 'credential:delete';
  if (path.includes('/credentials') && method === 'GET') return 'credential:access';

  // Admin actions
  if (path.includes('/admin/settings')) return 'admin:settings';
  if (path.includes('/backup')) return 'admin:backup';
  if (path.includes('/restore')) return 'admin:restore';

  // Environment actions
  if (path.includes('/promote')) return 'environment:promote';
  if (path.includes('/rollback')) return 'environment:rollback';

  // Default
  return `${method.toLowerCase()}:${getResourceType(req)}`;
}

/**
 * Get resource type from path
 */
function getResourceType(req: Request): string {
  const path = req.path;

  if (path.includes('/workflows')) return 'workflow';
  if (path.includes('/executions')) return 'execution';
  if (path.includes('/credentials')) return 'credential';
  if (path.includes('/users')) return 'user';
  if (path.includes('/webhooks')) return 'webhook';
  if (path.includes('/environments')) return 'environment';
  if (path.includes('/admin')) return 'admin';

  return 'unknown';
}

/**
 * Get resource ID from path
 */
function getResourceId(req: Request): string | undefined {
  // Match UUID or typical ID patterns
  const match = req.path.match(/\/([a-f0-9-]{36}|[a-z]+_[a-f0-9]+)/i);
  return match?.[1];
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ============================================================================
// ENCRYPTION VALIDATION
// ============================================================================

/**
 * Middleware to validate TLS/encryption
 */
export function requireEncryptionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if request is encrypted (HTTPS)
    const isEncrypted =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on';

    if (!isEncrypted && process.env.NODE_ENV === 'production') {
      logger.warn('Unencrypted request blocked', {
        path: req.path,
        ip: getClientIp(req),
      });

      return res.status(403).json({
        error: 'HTTPS required',
        message: 'All requests must be made over HTTPS',
      });
    }

    next();
  };
}

// ============================================================================
// SESSION SECURITY
// ============================================================================

/**
 * Middleware to enforce session security
 */
export function sessionSecurityMiddleware(options: {
  maxAge?: number;
  inactivityTimeout?: number;
} = {}) {
  const maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours
  const inactivityTimeout = options.inactivityTimeout || 30 * 60 * 1000; // 30 minutes

  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;

    if (session) {
      const now = Date.now();

      // Check session age
      if (session.createdAt && now - session.createdAt > maxAge) {
        logger.info('Session expired due to max age', {
          userId: session.userId,
        });
        session.destroy?.();
        return res.status(401).json({ error: 'Session expired' });
      }

      // Check inactivity
      if (session.lastActivity && now - session.lastActivity > inactivityTimeout) {
        logger.info('Session expired due to inactivity', {
          userId: session.userId,
        });
        session.destroy?.();
        return res.status(401).json({ error: 'Session expired due to inactivity' });
      }

      // Update last activity
      session.lastActivity = now;
    }

    next();
  };
}

// ============================================================================
// COMPLIANCE REPORT GENERATION
// ============================================================================

export interface ComplianceReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalEvents: number;
    byRiskLevel: Record<string, number>;
    byOutcome: Record<string, number>;
    byControl: Record<string, number>;
  };
  highRiskEvents: AuditLogEntry[];
  controlCoverage: Array<{
    controlId: string;
    name: string;
    eventCount: number;
    lastEvent?: Date;
  }>;
}

/**
 * Generate SOC 2 compliance report
 */
export async function generateComplianceReport(
  startDate: Date,
  endDate: Date
): Promise<ComplianceReport> {
  // This would query the audit_logs table and generate the report
  // Placeholder implementation
  return {
    generatedAt: new Date(),
    period: { start: startDate, end: endDate },
    summary: {
      totalEvents: 0,
      byRiskLevel: {},
      byOutcome: {},
      byControl: {},
    },
    highRiskEvents: [],
    controlCoverage: Object.entries(CONTROL_MAPPINGS).map(([key, value]) => ({
      controlId: value.controlId,
      name: value.name,
      eventCount: 0,
    })),
  };
}

export default {
  soc2AuditMiddleware,
  requireEncryptionMiddleware,
  sessionSecurityMiddleware,
  generateComplianceReport,
};

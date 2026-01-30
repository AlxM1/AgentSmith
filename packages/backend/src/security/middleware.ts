// @ts-nocheck
/**
 * AgentSmith Security Middleware
 * Comprehensive security middleware for maximum protection
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { sanitizeForLogging } from './encryption';

// ============================================
// RATE LIMITING
// ============================================

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per minute per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'Too many login attempts',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for workflow execution
 * 30 executions per minute per user
 */
export const executionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Execution rate limit exceeded',
    message: 'Too many workflow executions. Please try again later.',
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

/**
 * Rate limiter for webhook endpoints
 * 60 requests per minute per webhook
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests.',
  },
  keyGenerator: (req) => {
    // Rate limit by webhook path
    return req.path;
  },
});

// ============================================
// SECURITY HEADERS (Helmet configuration)
// ============================================

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "wss:", "ws:"], // Allow WebSocket connections
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS Protection
  xssFilter: true,
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ============================================
// INPUT VALIDATION & SANITIZATION
// ============================================

/**
 * Sanitize request body to prevent XSS and injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as any;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as any;
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key (remove potential injection characters)
    const sanitizedKey = key.replace(/[<>'"]/g, '');

    if (typeof value === 'string') {
      // Basic XSS prevention - encode dangerous characters
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

function sanitizeString(str: string): string {
  // Don't over-sanitize - just prevent the most dangerous patterns
  // Allow most content since workflows may need special characters
  return str
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:text\/html/gi, '') // Remove data: HTML URLs
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .trim();
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
  status: 'success' | 'failure';
  errorMessage?: string;
}

const auditLogs: AuditLogEntry[] = [];

/**
 * Log an audit event
 */
export function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date(),
    details: entry.details ? sanitizeForLogging(entry.details) : undefined,
  };

  // In production, this would write to database or external logging service
  auditLogs.push(fullEntry);

  // Keep only last 10000 entries in memory (for demo)
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[AUDIT]', JSON.stringify(fullEntry, null, 2));
  }
}

/**
 * Get recent audit logs
 */
export function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): AuditLogEntry[] {
  let filtered = [...auditLogs];

  if (filters?.userId) {
    filtered = filtered.filter(log => log.userId === filters.userId);
  }
  if (filters?.action) {
    filtered = filtered.filter(log => log.action === filters.action);
  }
  if (filters?.resource) {
    filtered = filtered.filter(log => log.resource === filters.resource);
  }
  if (filters?.startDate) {
    filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
  }
  if (filters?.endDate) {
    filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
  }

  // Return newest first
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (filters?.limit) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}

/**
 * Audit logging middleware - logs all API requests
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;

    logAuditEvent({
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      action: req.method,
      resource: req.baseUrl + req.path,
      resourceId: req.params.id,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: res.statusCode >= 400 ? 'failure' : 'success',
      details: {
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      },
    });

    return originalSend.call(this, body);
  };

  next();
}

// ============================================
// CORS CONFIGURATION
// ============================================

export function getCorsOptions() {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // In development, allow localhost on any port
      if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
  };
}

// ============================================
// REQUEST ID TRACKING
// ============================================

/**
 * Add unique request ID for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.get('X-Request-ID') ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

// ============================================
// IP WHITELIST/BLACKLIST
// ============================================

const ipBlacklist = new Set<string>();
const ipWhitelist = new Set<string>();

/**
 * Add IP to blacklist
 */
export function blacklistIP(ip: string): void {
  ipBlacklist.add(ip);
}

/**
 * Remove IP from blacklist
 */
export function unblacklistIP(ip: string): void {
  ipBlacklist.delete(ip);
}

/**
 * Add IP to whitelist (bypasses rate limiting)
 */
export function whitelistIP(ip: string): void {
  ipWhitelist.add(ip);
}

/**
 * IP filtering middleware
 */
export function ipFilterMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip || req.socket.remoteAddress || '';

  if (ipBlacklist.has(clientIP)) {
    logAuditEvent({
      action: 'BLOCKED_REQUEST',
      resource: req.path,
      ipAddress: clientIP,
      userAgent: req.get('user-agent') || 'unknown',
      status: 'failure',
      errorMessage: 'IP is blacklisted',
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked.',
    });
  }

  // Mark whitelisted IPs for rate limiter bypass
  if (ipWhitelist.has(clientIP)) {
    (req as any).ipWhitelisted = true;
  }

  next();
}

// ============================================
// SECURITY HEADERS FOR API RESPONSES
// ============================================

export function apiSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
}

// ============================================
// EXPORT ALL SECURITY MIDDLEWARE
// ============================================

export const securityMiddleware = {
  headers: securityHeaders,
  apiHeaders: apiSecurityHeaders,
  sanitizeInput,
  generalRateLimiter,
  authRateLimiter,
  executionRateLimiter,
  webhookRateLimiter,
  auditMiddleware,
  requestIdMiddleware,
  ipFilterMiddleware,
  getCorsOptions,
};

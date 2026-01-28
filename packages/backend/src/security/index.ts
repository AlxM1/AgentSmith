/**
 * AgentSmith Security Module
 * Centralized security exports
 */

export * from './encryption';
export * from './middleware';

// Re-export commonly used functions
export {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateApiKey,
  hashApiKey,
  encryptCredentials,
  decryptCredentials,
  maskSensitiveData,
  sanitizeForLogging,
} from './encryption';

export {
  securityMiddleware,
  generalRateLimiter,
  authRateLimiter,
  executionRateLimiter,
  webhookRateLimiter,
  securityHeaders,
  sanitizeInput,
  auditMiddleware,
  requestIdMiddleware,
  ipFilterMiddleware,
  getCorsOptions,
  logAuditEvent,
  getAuditLogs,
  blacklistIP,
  unblacklistIP,
  whitelistIP,
} from './middleware';

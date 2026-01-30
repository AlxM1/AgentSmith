/**
 * AgentSmith Security Module
 * Centralized security exports
 */

export * from './encryption.js';
export * from './middleware.js';

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
} from './encryption.js';

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
} from './middleware.js';

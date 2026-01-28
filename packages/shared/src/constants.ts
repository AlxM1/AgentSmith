// AgentSmith Constants

export const APP_NAME = 'AgentSmith';
export const APP_VERSION = '1.0.0';

// Workflow States
export const WORKFLOW_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
} as const;

// Execution States
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  WAITING: 'waiting',
} as const;

// Node Types
export const NODE_CATEGORIES = {
  TRIGGER: 'trigger',
  ACTION: 'action',
  TRANSFORM: 'transform',
  FLOW: 'flow',
  AI: 'ai',
  INTEGRATION: 'integration',
  UTILITY: 'utility',
} as const;

// Trigger Types
export const TRIGGER_TYPES = {
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
  SCHEDULE: 'schedule',
  EVENT: 'event',
} as const;

// Connection Types
export const CONNECTION_TYPES = {
  MAIN: 'main',
  AI_MEMORY: 'ai_memory',
  AI_TOOL: 'ai_tool',
} as const;

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const;

// Credential Types
export const CREDENTIAL_TYPES = {
  API_KEY: 'apiKey',
  OAUTH2: 'oauth2',
  BASIC_AUTH: 'basicAuth',
  BEARER_TOKEN: 'bearerToken',
  CUSTOM: 'custom',
} as const;

// HTTP Methods
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Retry Configuration
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
};

// Queue Names
export const QUEUE_NAMES = {
  WORKFLOW_EXECUTION: 'workflow-execution',
  SCHEDULED_TRIGGERS: 'scheduled-triggers',
  WEBHOOK_PROCESSING: 'webhook-processing',
  NOTIFICATIONS: 'notifications',
} as const;

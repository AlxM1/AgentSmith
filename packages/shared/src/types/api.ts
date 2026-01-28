// API Type Definitions

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: IApiError;
  meta?: IApiMeta;
}

export interface IApiError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface IApiMeta {
  pagination?: IPagination;
  timestamp?: string;
  requestId?: string;
}

export interface IPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface IPaginationParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IListQuery extends IPaginationParams {
  search?: string;
  filter?: Record<string, unknown>;
}

export interface IWebhookPayload {
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  method: string;
  path: string;
  webhookId: string;
  workflowId: string;
}

export interface IWebhookResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  noWebhookResponse?: boolean;
}

export interface IHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
  services: IServiceHealth[];
}

export interface IServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

// API Error Codes
export const API_ERROR_CODES = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Workflow errors
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  WORKFLOW_INACTIVE: 'WORKFLOW_INACTIVE',
  EXECUTION_FAILED: 'EXECUTION_FAILED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

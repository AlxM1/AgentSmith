/**
 * Admin Panel API Client
 * Centralized API communication for the admin panel
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

class AdminApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('admin_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('admin_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('admin_token');
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: User }>('/api/admin/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(result.token);
    return result;
  }

  async logout() {
    await this.request('/api/admin/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getProfile() {
    return this.request<User>('/api/admin/auth/profile');
  }

  // ============================================
  // DASHBOARD / STATS
  // ============================================

  async getDashboardStats() {
    return this.request<DashboardStats>('/api/admin/stats/dashboard');
  }

  async getSystemHealth() {
    return this.request<SystemHealth>('/api/admin/stats/health');
  }

  async getExecutionTrend(days: number = 7) {
    return this.request<ExecutionTrend[]>(`/api/admin/stats/executions/trend?days=${days}`);
  }

  async getNodeUsageStats() {
    return this.request<NodeUsage[]>('/api/admin/stats/nodes/usage');
  }

  // ============================================
  // USERS
  // ============================================

  async getUsers(params?: { page?: number; limit?: number; search?: string; role?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    return this.request<PaginatedResponse<User>>(`/api/admin/users?${query}`);
  }

  async getUser(id: string) {
    return this.request<User>(`/api/admin/users/${id}`);
  }

  async createUser(data: CreateUserRequest) {
    return this.request<User>('/api/admin/users', {
      method: 'POST',
      body: data,
    });
  }

  async updateUser(id: string, data: UpdateUserRequest) {
    return this.request<User>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteUser(id: string) {
    return this.request<void>(`/api/admin/users/${id}`, { method: 'DELETE' });
  }

  async resetUserPassword(id: string) {
    return this.request<{ temporaryPassword: string }>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
    });
  }

  // ============================================
  // WORKFLOWS
  // ============================================

  async getWorkflows(params?: { page?: number; limit?: number; search?: string; active?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.active !== undefined) query.set('active', String(params.active));
    return this.request<PaginatedResponse<Workflow>>(`/api/admin/workflows?${query}`);
  }

  async getWorkflow(id: string) {
    return this.request<Workflow>(`/api/admin/workflows/${id}`);
  }

  async toggleWorkflowActive(id: string, active: boolean) {
    return this.request<Workflow>(`/api/admin/workflows/${id}/active`, {
      method: 'PATCH',
      body: { active },
    });
  }

  async deleteWorkflow(id: string) {
    return this.request<void>(`/api/admin/workflows/${id}`, { method: 'DELETE' });
  }

  // ============================================
  // EXECUTIONS
  // ============================================

  async getExecutions(params?: {
    page?: number;
    limit?: number;
    workflowId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.workflowId) query.set('workflowId', params.workflowId);
    if (params?.status) query.set('status', params.status);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return this.request<PaginatedResponse<Execution>>(`/api/admin/executions?${query}`);
  }

  async getExecution(id: string) {
    return this.request<Execution>(`/api/admin/executions/${id}`);
  }

  async cancelExecution(id: string) {
    return this.request<Execution>(`/api/admin/executions/${id}/cancel`, { method: 'POST' });
  }

  async retryExecution(id: string) {
    return this.request<Execution>(`/api/admin/executions/${id}/retry`, { method: 'POST' });
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.action) query.set('action', params.action);
    if (params?.resource) query.set('resource', params.resource);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return this.request<PaginatedResponse<AuditLog>>(`/api/admin/audit-logs?${query}`);
  }

  // ============================================
  // SYSTEM SETTINGS
  // ============================================

  async getSettings() {
    return this.request<SystemSettings>('/api/admin/settings');
  }

  async updateSettings(settings: Partial<SystemSettings>) {
    return this.request<SystemSettings>('/api/admin/settings', {
      method: 'PATCH',
      body: settings,
    });
  }

  async testEmailSettings(email: string) {
    return this.request<{ success: boolean }>('/api/admin/settings/test-email', {
      method: 'POST',
      body: { email },
    });
  }

  // ============================================
  // CREDENTIALS (Admin view)
  // ============================================

  async getCredentialTypes() {
    return this.request<CredentialType[]>('/api/admin/credentials/types');
  }

  async getCredentialUsage() {
    return this.request<CredentialUsage[]>('/api/admin/credentials/usage');
  }
}

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'admin' | 'user' | 'viewer';
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user' | 'viewer';
  isActive?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  userId: string;
  userEmail: string;
  nodeCount: number;
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode: 'manual' | 'trigger' | 'webhook' | 'schedule';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  error?: string;
  userId: string;
  userEmail: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  executionsToday: number;
  successRate: number;
  averageExecutionTime: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpu: number;
  memory: number;
  storage: number;
  queueSize: number;
  activeWorkers: number;
  uptime: number;
  lastCheck: string;
}

export interface ExecutionTrend {
  date: string;
  total: number;
  successful: number;
  failed: number;
}

export interface NodeUsage {
  nodeType: string;
  count: number;
  percentage: number;
}

export interface SystemSettings {
  general: {
    instanceName: string;
    timezone: string;
    dateFormat: string;
  };
  execution: {
    defaultTimeout: number;
    maxRetries: number;
    saveExecutionData: boolean;
    pruneExecutionsAfterDays: number;
  };
  security: {
    allowSelfRegistration: boolean;
    enforce2FA: boolean;
    sessionTimeoutHours: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    ipWhitelist: string[];
    ipBlacklist: string[];
  };
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    fromEmail: string;
    fromName: string;
  };
}

export interface CredentialType {
  name: string;
  displayName: string;
  description: string;
  usageCount: number;
}

export interface CredentialUsage {
  credentialId: string;
  credentialName: string;
  type: string;
  workflowCount: number;
  lastUsed?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Singleton instance
export const apiClient = new AdminApiClient(API_BASE_URL);
export default apiClient;

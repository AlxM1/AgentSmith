/**
 * Admin Panel API Hooks
 * React Query hooks for data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  Workflow,
  Execution,
  AuditLog,
  SystemSettings,
} from '../api/client';

// ============================================
// QUERY KEYS
// ============================================

export const queryKeys = {
  // Dashboard
  dashboardStats: ['dashboard', 'stats'] as const,
  systemHealth: ['system', 'health'] as const,
  executionTrend: (days: number) => ['executions', 'trend', days] as const,
  nodeUsage: ['nodes', 'usage'] as const,

  // Users
  users: ['users'] as const,
  usersList: (params?: Record<string, unknown>) => ['users', 'list', params] as const,
  user: (id: string) => ['users', id] as const,

  // Workflows
  workflows: ['workflows'] as const,
  workflowsList: (params?: Record<string, unknown>) => ['workflows', 'list', params] as const,
  workflow: (id: string) => ['workflows', id] as const,

  // Executions
  executions: ['executions'] as const,
  executionsList: (params?: Record<string, unknown>) => ['executions', 'list', params] as const,
  execution: (id: string) => ['executions', id] as const,

  // Audit Logs
  auditLogs: ['audit-logs'] as const,
  auditLogsList: (params?: Record<string, unknown>) => ['audit-logs', 'list', params] as const,

  // Settings
  settings: ['settings'] as const,

  // Credentials
  credentialTypes: ['credentials', 'types'] as const,
  credentialUsage: ['credentials', 'usage'] as const,
};

// ============================================
// DASHBOARD HOOKS
// ============================================

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiClient.getDashboardStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: () => apiClient.getSystemHealth(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useExecutionTrend(days: number = 7) {
  return useQuery({
    queryKey: queryKeys.executionTrend(days),
    queryFn: () => apiClient.getExecutionTrend(days),
  });
}

export function useNodeUsage() {
  return useQuery({
    queryKey: queryKeys.nodeUsage,
    queryFn: () => apiClient.getNodeUsageStats(),
  });
}

// ============================================
// USER HOOKS
// ============================================

export function useUsers(params?: { page?: number; limit?: number; search?: string; role?: string }) {
  return useQuery({
    queryKey: queryKeys.usersList(params),
    queryFn: () => apiClient.getUsers(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => apiClient.getUser(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) => apiClient.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      apiClient.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) => apiClient.resetUserPassword(id),
  });
}

// ============================================
// WORKFLOW HOOKS
// ============================================

export function useWorkflows(params?: {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.workflowsList(params),
    queryFn: () => apiClient.getWorkflows(params),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflow(id),
    queryFn: () => apiClient.getWorkflow(id),
    enabled: !!id,
  });
}

export function useToggleWorkflowActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.toggleWorkflowActive(id, active),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow(id) });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

// ============================================
// EXECUTION HOOKS
// ============================================

export function useExecutions(params?: {
  page?: number;
  limit?: number;
  workflowId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: queryKeys.executionsList(params),
    queryFn: () => apiClient.getExecutions(params),
  });
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: queryKeys.execution(id),
    queryFn: () => apiClient.getExecution(id),
    enabled: !!id,
  });
}

export function useCancelExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.cancelExecution(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executions });
      queryClient.invalidateQueries({ queryKey: queryKeys.execution(id) });
    },
  });
}

export function useRetryExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.retryExecution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executions });
    },
  });
}

// ============================================
// AUDIT LOG HOOKS
// ============================================

export function useAuditLogs(params?: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: queryKeys.auditLogsList(params),
    queryFn: () => apiClient.getAuditLogs(params),
  });
}

// ============================================
// SETTINGS HOOKS
// ============================================

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiClient.getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SystemSettings>) => apiClient.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

export function useTestEmailSettings() {
  return useMutation({
    mutationFn: (email: string) => apiClient.testEmailSettings(email),
  });
}

// ============================================
// CREDENTIAL HOOKS
// ============================================

export function useCredentialTypes() {
  return useQuery({
    queryKey: queryKeys.credentialTypes,
    queryFn: () => apiClient.getCredentialTypes(),
  });
}

export function useCredentialUsage() {
  return useQuery({
    queryKey: queryKeys.credentialUsage,
    queryFn: () => apiClient.getCredentialUsage(),
  });
}

import axios, { AxiosError } from 'axios';
import type { IApiResponse } from '@agentsmith/shared';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<IApiResponse>) => {
    const originalRequest = error.config;

    // Handle 401 errors - try to refresh token
    if (error.response?.status === 401 && originalRequest) {
      const tokens = useAuthStore.getState().tokens;

      if (tokens?.refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: tokens.refreshToken,
          });

          if (response.data.success) {
            useAuthStore.getState().updateTokens(response.data.data.tokens);
            originalRequest.headers.Authorization = `Bearer ${response.data.data.tokens.accessToken}`;
            return api(originalRequest);
          }
        } catch {
          // Refresh failed, logout
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<IApiResponse>('/auth/login', { email, password });
    return response.data;
  },

  register: async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    const response = await api.post<IApiResponse>('/auth/register', data);
    return response.data;
  },

  logout: async () => {
    const response = await api.post<IApiResponse>('/auth/logout');
    return response.data;
  },

  me: async () => {
    const response = await api.get<IApiResponse>('/auth/me');
    return response.data;
  },
};

export const workflowApi = {
  list: async (params?: { page?: number; perPage?: number; search?: string; status?: string }) => {
    const response = await api.get<IApiResponse>('/workflows', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<IApiResponse>(`/workflows/${id}`);
    return response.data;
  },

  create: async (data: { name: string; description?: string }) => {
    const response = await api.post<IApiResponse>('/workflows', data);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put<IApiResponse>(`/workflows/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<IApiResponse>(`/workflows/${id}`);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.post<IApiResponse>(`/workflows/${id}/activate`);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.post<IApiResponse>(`/workflows/${id}/deactivate`);
    return response.data;
  },

  execute: async (id: string, inputData?: Record<string, unknown>) => {
    const response = await api.post<IApiResponse>(`/workflows/${id}/execute`, { inputData });
    return response.data;
  },

  duplicate: async (id: string, name?: string) => {
    const response = await api.post<IApiResponse>(`/workflows/${id}/duplicate`, { name });
    return response.data;
  },

  export: async (id: string) => {
    const response = await api.get<IApiResponse>(`/workflows/${id}/export`);
    return response.data;
  },

  import: async (workflow: Record<string, unknown>) => {
    const response = await api.post<IApiResponse>('/workflows/import', { workflow });
    return response.data;
  },
};

export const executionApi = {
  list: async (params?: {
    page?: number;
    perPage?: number;
    workflowId?: string;
    status?: string;
  }) => {
    const response = await api.get<IApiResponse>('/executions', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<IApiResponse>(`/executions/${id}`);
    return response.data;
  },

  stop: async (id: string) => {
    const response = await api.post<IApiResponse>(`/executions/${id}/stop`);
    return response.data;
  },

  retry: async (id: string) => {
    const response = await api.post<IApiResponse>(`/executions/${id}/retry`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<IApiResponse>(`/executions/${id}`);
    return response.data;
  },

  stats: async (workflowId?: string) => {
    const response = await api.get<IApiResponse>('/executions/stats', {
      params: { workflowId },
    });
    return response.data;
  },
};

export const credentialApi = {
  list: async (params?: { page?: number; perPage?: number; search?: string; type?: string }) => {
    const response = await api.get<IApiResponse>('/credentials', { params });
    return response.data;
  },

  get: async (id: string, includeData?: boolean) => {
    const response = await api.get<IApiResponse>(`/credentials/${id}`, {
      params: { includeData },
    });
    return response.data;
  },

  create: async (data: { name: string; type: string; data: Record<string, unknown> }) => {
    const response = await api.post<IApiResponse>('/credentials', data);
    return response.data;
  },

  update: async (id: string, data: { name?: string; data?: Record<string, unknown> }) => {
    const response = await api.put<IApiResponse>(`/credentials/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<IApiResponse>(`/credentials/${id}`);
    return response.data;
  },

  types: async () => {
    const response = await api.get<IApiResponse>('/credentials/types');
    return response.data;
  },

  test: async (id: string) => {
    const response = await api.post<IApiResponse>(`/credentials/${id}/test`);
    return response.data;
  },
};

export const nodeApi = {
  list: async () => {
    const response = await api.get<IApiResponse>('/nodes');
    return response.data;
  },

  categories: async () => {
    const response = await api.get<IApiResponse>('/nodes/categories');
    return response.data;
  },

  get: async (name: string) => {
    const response = await api.get<IApiResponse>(`/nodes/${name}`);
    return response.data;
  },
};

export const userApi = {
  list: async (params?: { page?: number; perPage?: number; search?: string; role?: string }) => {
    const response = await api.get<IApiResponse>('/users', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<IApiResponse>(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }) => {
    const response = await api.post<IApiResponse>('/users', data);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put<IApiResponse>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<IApiResponse>(`/users/${id}`);
    return response.data;
  },
};

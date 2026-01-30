/**
 * API Client for AgentSmith
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import chalk from 'chalk';
import { getApiUrl, getApiKey, config } from './config.js';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: config.get('timeout') || 30000,
    });

    // Add request interceptor
    this.client.interceptors.request.use((req) => {
      req.baseURL = getApiUrl();
      const apiKey = getApiKey();
      if (apiKey) {
        req.headers['X-API-Key'] = apiKey;
      }
      return req;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;

          if (status === 401) {
            console.error(chalk.red('Authentication failed. Check your API key.'));
          } else if (status === 403) {
            console.error(chalk.red('Permission denied.'));
          } else if (status === 404) {
            console.error(chalk.red('Resource not found.'));
          } else {
            console.error(chalk.red(`API Error (${status}):`), data?.message || error.message);
          }
        } else if (error.code === 'ECONNREFUSED') {
          console.error(chalk.red('Cannot connect to server. Is AgentSmith running?'));
        } else {
          console.error(chalk.red('Network error:'), error.message);
        }

        throw error;
      }
    );
  }

  // Workflows
  async listWorkflows(params?: { active?: boolean; tags?: string; folderId?: string }) {
    const response = await this.client.get('/workflows', { params });
    return response.data;
  }

  async getWorkflow(id: string) {
    const response = await this.client.get(`/workflows/${id}`);
    return response.data;
  }

  async createWorkflow(data: any) {
    const response = await this.client.post('/workflows', data);
    return response.data;
  }

  async updateWorkflow(id: string, data: any) {
    const response = await this.client.patch(`/workflows/${id}`, data);
    return response.data;
  }

  async deleteWorkflow(id: string) {
    const response = await this.client.delete(`/workflows/${id}`);
    return response.data;
  }

  async activateWorkflow(id: string) {
    const response = await this.client.post(`/workflows/${id}/activate`);
    return response.data;
  }

  async deactivateWorkflow(id: string) {
    const response = await this.client.post(`/workflows/${id}/deactivate`);
    return response.data;
  }

  async executeWorkflow(id: string, data?: any) {
    const response = await this.client.post(`/workflows/${id}/execute`, { data });
    return response.data;
  }

  // Credentials
  async listCredentials(params?: { type?: string }) {
    const response = await this.client.get('/credentials', { params });
    return response.data;
  }

  async getCredential(id: string) {
    const response = await this.client.get(`/credentials/${id}`);
    return response.data;
  }

  async createCredential(data: any) {
    const response = await this.client.post('/credentials', data);
    return response.data;
  }

  async deleteCredential(id: string) {
    const response = await this.client.delete(`/credentials/${id}`);
    return response.data;
  }

  async getCredentialTypes() {
    const response = await this.client.get('/credentials/types');
    return response.data;
  }

  // Executions
  async listExecutions(params?: { workflowId?: string; status?: string; limit?: number }) {
    const response = await this.client.get('/executions', { params });
    return response.data;
  }

  async getExecution(id: string) {
    const response = await this.client.get(`/executions/${id}`);
    return response.data;
  }

  async stopExecution(id: string) {
    const response = await this.client.post(`/executions/${id}/stop`);
    return response.data;
  }

  async retryExecution(id: string) {
    const response = await this.client.post(`/executions/${id}/retry`);
    return response.data;
  }

  async deleteExecution(id: string) {
    const response = await this.client.delete(`/executions/${id}`);
    return response.data;
  }

  // Import/Export
  async exportWorkflow(id: string, options?: { withCredentials?: boolean }) {
    const response = await this.client.get(`/import-export/workflow/${id}`, { params: options });
    return response.data;
  }

  async importWorkflow(data: any, options?: { overwrite?: boolean }) {
    const response = await this.client.post('/import-export/workflow', data, { params: options });
    return response.data;
  }

  // Server
  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getServerInfo() {
    const response = await this.client.get('/info');
    return response.data;
  }

  async getMetrics() {
    const response = await this.client.get('/metrics');
    return response.data;
  }
}

export const api = new ApiClient();

/**
 * CLI Configuration Management
 */

import Conf from 'conf';

interface CliConfig {
  apiUrl: string;
  apiKey: string;
  defaultWorkspace?: string;
  outputFormat: 'table' | 'json' | 'yaml';
  colorOutput: boolean;
  timeout: number;
}

const schema = {
  apiUrl: {
    type: 'string' as const,
    default: '',
  },
  apiKey: {
    type: 'string' as const,
    default: '',
  },
  defaultWorkspace: {
    type: 'string' as const,
  },
  outputFormat: {
    type: 'string' as const,
    default: 'table',
    enum: ['table', 'json', 'yaml'],
  },
  colorOutput: {
    type: 'boolean' as const,
    default: true,
  },
  timeout: {
    type: 'number' as const,
    default: 30000,
  },
};

export const config = new Conf<CliConfig>({
  projectName: 'agentsmith-cli',
  schema,
});

export function getApiUrl(): string {
  return config.get('apiUrl') || process.env.AGENTSMITH_API_URL || 'http://localhost:5678/api/v1';
}

export function getApiKey(): string {
  return config.get('apiKey') || process.env.AGENTSMITH_API_KEY || '';
}

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return headers;
}

/**
 * External Secrets Service
 *
 * Integrates with external secret managers:
 * - HashiCorp Vault
 * - AWS Secrets Manager
 * - Azure Key Vault
 * - Google Cloud Secret Manager
 * - Infisical
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type SecretProvider = 'vault' | 'aws' | 'azure' | 'gcp' | 'infisical';

export interface ExternalSecretsConfig {
  provider: SecretProvider;
  enabled: boolean;
  // HashiCorp Vault
  vault?: {
    address: string;
    token?: string;
    roleId?: string;
    secretId?: string;
    namespace?: string;
    mountPath?: string;
    kvVersion?: 1 | 2;
  };
  // AWS Secrets Manager
  aws?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    roleArn?: string;
    prefix?: string;
  };
  // Azure Key Vault
  azure?: {
    vaultUrl: string;
    tenantId: string;
    clientId: string;
    clientSecret?: string;
    useManagedIdentity?: boolean;
  };
  // Google Cloud Secret Manager
  gcp?: {
    projectId: string;
    keyFile?: string;
    useDefaultCredentials?: boolean;
  };
  // Infisical
  infisical?: {
    siteUrl: string;
    serviceToken: string;
    projectId: string;
    environment: string;
  };
  // Cache settings
  cacheTtlMs?: number;
  refreshIntervalMs?: number;
}

export interface SecretValue {
  key: string;
  value: string;
  version?: string;
  metadata?: Record<string, string>;
  expiresAt?: Date;
  cachedAt: Date;
}

interface CachedSecret {
  value: SecretValue;
  expiresAt: number;
}

// ============================================================================
// EXTERNAL SECRETS SERVICE
// ============================================================================

class ExternalSecretsService {
  private config: ExternalSecretsConfig | null = null;
  private cache: Map<string, CachedSecret> = new Map();
  private vaultClient: AxiosInstance | null = null;
  private vaultToken: string | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize the external secrets service
   */
  async initialize(config: ExternalSecretsConfig): Promise<void> {
    this.config = {
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes default cache
      refreshIntervalMs: 60 * 1000, // Refresh every minute
      ...config,
    };

    if (!this.config.enabled) {
      logger.info('External secrets service disabled');
      return;
    }

    try {
      switch (this.config.provider) {
        case 'vault':
          await this.initializeVault();
          break;
        case 'aws':
          await this.initializeAWS();
          break;
        case 'azure':
          await this.initializeAzure();
          break;
        case 'gcp':
          await this.initializeGCP();
          break;
        case 'infisical':
          await this.initializeInfisical();
          break;
        default:
          throw new Error(`Unknown secrets provider: ${this.config.provider}`);
      }

      this.isInitialized = true;
      this.startRefreshLoop();

      logger.info('External secrets service initialized', {
        provider: this.config.provider,
      });
    } catch (error) {
      logger.error('Failed to initialize external secrets service', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get a secret by key
   */
  async getSecret(key: string, options?: { forceRefresh?: boolean }): Promise<SecretValue | null> {
    if (!this.config?.enabled || !this.isInitialized) {
      return null;
    }

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    try {
      let secret: SecretValue | null = null;

      switch (this.config.provider) {
        case 'vault':
          secret = await this.getVaultSecret(key);
          break;
        case 'aws':
          secret = await this.getAWSSecret(key);
          break;
        case 'azure':
          secret = await this.getAzureSecret(key);
          break;
        case 'gcp':
          secret = await this.getGCPSecret(key);
          break;
        case 'infisical':
          secret = await this.getInfisicalSecret(key);
          break;
      }

      if (secret) {
        // Cache the secret
        this.cache.set(key, {
          value: secret,
          expiresAt: Date.now() + (this.config.cacheTtlMs || 300000),
        });
      }

      return secret;
    } catch (error) {
      logger.error('Failed to fetch secret', {
        key,
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get multiple secrets
   */
  async getSecrets(keys: string[]): Promise<Map<string, SecretValue>> {
    const results = new Map<string, SecretValue>();

    await Promise.all(
      keys.map(async (key) => {
        const secret = await this.getSecret(key);
        if (secret) {
          results.set(key, secret);
        }
      })
    );

    return results;
  }

  /**
   * List all available secret keys
   */
  async listSecrets(path?: string): Promise<string[]> {
    if (!this.config?.enabled || !this.isInitialized) {
      return [];
    }

    try {
      switch (this.config.provider) {
        case 'vault':
          return await this.listVaultSecrets(path);
        case 'aws':
          return await this.listAWSSecrets(path);
        case 'azure':
          return await this.listAzureSecrets();
        case 'gcp':
          return await this.listGCPSecrets();
        case 'infisical':
          return await this.listInfisicalSecrets();
        default:
          return [];
      }
    } catch (error) {
      logger.error('Failed to list secrets', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Secret cache cleared');
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.cache.clear();
    this.isInitialized = false;
    logger.info('External secrets service shut down');
  }

  // ============================================================================
  // HASHICORP VAULT
  // ============================================================================

  private async initializeVault(): Promise<void> {
    const vault = this.config?.vault;
    if (!vault?.address) {
      throw new Error('Vault address is required');
    }

    this.vaultClient = axios.create({
      baseURL: vault.address,
      headers: vault.namespace ? { 'X-Vault-Namespace': vault.namespace } : {},
      timeout: 10000,
    });

    // Authenticate
    if (vault.token) {
      this.vaultToken = vault.token;
    } else if (vault.roleId && vault.secretId) {
      await this.vaultAppRoleLogin(vault.roleId, vault.secretId);
    } else {
      throw new Error('Vault authentication required (token or AppRole)');
    }

    logger.debug('Vault client initialized', { address: vault.address });
  }

  private async vaultAppRoleLogin(roleId: string, secretId: string): Promise<void> {
    if (!this.vaultClient) throw new Error('Vault client not initialized');

    const response = await this.vaultClient.post('/v1/auth/approle/login', {
      role_id: roleId,
      secret_id: secretId,
    });

    this.vaultToken = response.data.auth.client_token;

    // Schedule token renewal
    const leaseDuration = response.data.auth.lease_duration;
    if (leaseDuration > 0) {
      setTimeout(
        () => this.vaultAppRoleLogin(roleId, secretId),
        (leaseDuration - 60) * 1000 // Renew 1 minute before expiry
      );
    }
  }

  private async getVaultSecret(key: string): Promise<SecretValue | null> {
    if (!this.vaultClient || !this.vaultToken) {
      throw new Error('Vault not initialized');
    }

    const vault = this.config?.vault;
    const mountPath = vault?.mountPath || 'secret';
    const kvVersion = vault?.kvVersion || 2;
    const path = kvVersion === 2 ? `${mountPath}/data/${key}` : `${mountPath}/${key}`;

    try {
      const response = await this.vaultClient.get(`/v1/${path}`, {
        headers: { 'X-Vault-Token': this.vaultToken },
      });

      const data = kvVersion === 2 ? response.data.data.data : response.data.data;
      const metadata = kvVersion === 2 ? response.data.data.metadata : undefined;

      // Return the first value or the whole object as JSON
      const value = typeof data === 'object' ? JSON.stringify(data) : String(data);

      return {
        key,
        value,
        version: metadata?.version?.toString(),
        metadata: metadata,
        cachedAt: new Date(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async listVaultSecrets(path?: string): Promise<string[]> {
    if (!this.vaultClient || !this.vaultToken) {
      throw new Error('Vault not initialized');
    }

    const vault = this.config?.vault;
    const mountPath = vault?.mountPath || 'secret';
    const kvVersion = vault?.kvVersion || 2;
    const listPath = kvVersion === 2
      ? `${mountPath}/metadata/${path || ''}`
      : `${mountPath}/${path || ''}`;

    try {
      const response = await this.vaultClient.request({
        method: 'LIST',
        url: `/v1/${listPath}`,
        headers: { 'X-Vault-Token': this.vaultToken },
      });

      return response.data.data.keys || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // ============================================================================
  // AWS SECRETS MANAGER
  // ============================================================================

  private async initializeAWS(): Promise<void> {
    const aws = this.config?.aws;
    if (!aws?.region) {
      throw new Error('AWS region is required');
    }
    logger.debug('AWS Secrets Manager initialized', { region: aws.region });
  }

  private async getAWSSecret(key: string): Promise<SecretValue | null> {
    const aws = this.config?.aws;
    if (!aws) throw new Error('AWS not configured');

    const secretName = aws.prefix ? `${aws.prefix}/${key}` : key;

    // Using AWS SDK v3 style request signing
    const host = `secretsmanager.${aws.region}.amazonaws.com`;
    const service = 'secretsmanager';
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const body = JSON.stringify({
      SecretId: secretName,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.GetSecretValue',
      'X-Amz-Date': amzDate,
      Host: host,
    };

    // Sign request if credentials provided
    if (aws.accessKeyId && aws.secretAccessKey) {
      const signature = this.signAWSRequest(
        'POST',
        '/',
        headers,
        body,
        aws.region,
        service,
        aws.accessKeyId,
        aws.secretAccessKey,
        dateStamp,
        amzDate
      );
      headers['Authorization'] = signature;
    }

    try {
      const response = await axios.post(`https://${host}`, body, {
        headers,
        timeout: 10000,
      });

      return {
        key,
        value: response.data.SecretString || Buffer.from(response.data.SecretBinary, 'base64').toString(),
        version: response.data.VersionId,
        metadata: {
          arn: response.data.ARN,
          name: response.data.Name,
        },
        cachedAt: new Date(),
      };
    } catch (error: any) {
      if (error.response?.data?.Message?.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  private async listAWSSecrets(prefix?: string): Promise<string[]> {
    const aws = this.config?.aws;
    if (!aws) throw new Error('AWS not configured');

    const host = `secretsmanager.${aws.region}.amazonaws.com`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const body = JSON.stringify({
      MaxResults: 100,
      Filters: prefix
        ? [{ Key: 'name', Values: [prefix] }]
        : undefined,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.ListSecrets',
      'X-Amz-Date': amzDate,
      Host: host,
    };

    if (aws.accessKeyId && aws.secretAccessKey) {
      headers['Authorization'] = this.signAWSRequest(
        'POST',
        '/',
        headers,
        body,
        aws.region,
        'secretsmanager',
        aws.accessKeyId,
        aws.secretAccessKey,
        dateStamp,
        amzDate
      );
    }

    const response = await axios.post(`https://${host}`, body, {
      headers,
      timeout: 10000,
    });

    return (response.data.SecretList || []).map((s: any) => s.Name);
  }

  private signAWSRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: string,
    region: string,
    service: string,
    accessKey: string,
    secretKey: string,
    dateStamp: string,
    amzDate: string
  ): string {
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(';');

    const canonicalHeaders = Object.entries(headers)
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .sort()
      .join('\n');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders + '\n',
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  // ============================================================================
  // AZURE KEY VAULT
  // ============================================================================

  private async initializeAzure(): Promise<void> {
    const azure = this.config?.azure;
    if (!azure?.vaultUrl) {
      throw new Error('Azure Key Vault URL is required');
    }
    logger.debug('Azure Key Vault initialized', { vaultUrl: azure.vaultUrl });
  }

  private async getAzureSecret(key: string): Promise<SecretValue | null> {
    const azure = this.config?.azure;
    if (!azure) throw new Error('Azure not configured');

    const token = await this.getAzureToken();
    const url = `${azure.vaultUrl}/secrets/${key}?api-version=7.4`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      return {
        key,
        value: response.data.value,
        version: response.data.id.split('/').pop(),
        metadata: {
          contentType: response.data.contentType,
          enabled: response.data.attributes?.enabled?.toString(),
        },
        expiresAt: response.data.attributes?.exp
          ? new Date(response.data.attributes.exp * 1000)
          : undefined,
        cachedAt: new Date(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async listAzureSecrets(): Promise<string[]> {
    const azure = this.config?.azure;
    if (!azure) throw new Error('Azure not configured');

    const token = await this.getAzureToken();
    const url = `${azure.vaultUrl}/secrets?api-version=7.4`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    return (response.data.value || []).map((s: any) => s.id.split('/').pop());
  }

  private async getAzureToken(): Promise<string> {
    const azure = this.config?.azure;
    if (!azure) throw new Error('Azure not configured');

    const tokenUrl = `https://login.microsoftonline.com/${azure.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: azure.clientId,
      client_secret: azure.clientSecret || '',
      scope: 'https://vault.azure.net/.default',
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    return response.data.access_token;
  }

  // ============================================================================
  // GOOGLE CLOUD SECRET MANAGER
  // ============================================================================

  private async initializeGCP(): Promise<void> {
    const gcp = this.config?.gcp;
    if (!gcp?.projectId) {
      throw new Error('GCP project ID is required');
    }
    logger.debug('GCP Secret Manager initialized', { projectId: gcp.projectId });
  }

  private async getGCPSecret(key: string): Promise<SecretValue | null> {
    const gcp = this.config?.gcp;
    if (!gcp) throw new Error('GCP not configured');

    const token = await this.getGCPToken();
    const url = `https://secretmanager.googleapis.com/v1/projects/${gcp.projectId}/secrets/${key}/versions/latest:access`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const payload = response.data.payload;
      const value = payload.data
        ? Buffer.from(payload.data, 'base64').toString('utf-8')
        : '';

      return {
        key,
        value,
        version: response.data.name.split('/').pop(),
        cachedAt: new Date(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async listGCPSecrets(): Promise<string[]> {
    const gcp = this.config?.gcp;
    if (!gcp) throw new Error('GCP not configured');

    const token = await this.getGCPToken();
    const url = `https://secretmanager.googleapis.com/v1/projects/${gcp.projectId}/secrets`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    return (response.data.secrets || []).map((s: any) => s.name.split('/').pop());
  }

  private async getGCPToken(): Promise<string> {
    // For simplicity, using metadata server (works on GCP infrastructure)
    // In production, use proper service account authentication
    const response = await axios.get(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 5000,
      }
    );
    return response.data.access_token;
  }

  // ============================================================================
  // INFISICAL
  // ============================================================================

  private async initializeInfisical(): Promise<void> {
    const infisical = this.config?.infisical;
    if (!infisical?.siteUrl || !infisical?.serviceToken) {
      throw new Error('Infisical site URL and service token are required');
    }
    logger.debug('Infisical initialized', { siteUrl: infisical.siteUrl });
  }

  private async getInfisicalSecret(key: string): Promise<SecretValue | null> {
    const infisical = this.config?.infisical;
    if (!infisical) throw new Error('Infisical not configured');

    const url = `${infisical.siteUrl}/api/v3/secrets/${key}`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${infisical.serviceToken}` },
        params: {
          workspaceId: infisical.projectId,
          environment: infisical.environment,
        },
        timeout: 10000,
      });

      return {
        key,
        value: response.data.secret.secretValue,
        version: response.data.secret.version?.toString(),
        cachedAt: new Date(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async listInfisicalSecrets(): Promise<string[]> {
    const infisical = this.config?.infisical;
    if (!infisical) throw new Error('Infisical not configured');

    const url = `${infisical.siteUrl}/api/v3/secrets`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${infisical.serviceToken}` },
      params: {
        workspaceId: infisical.projectId,
        environment: infisical.environment,
      },
      timeout: 10000,
    });

    return (response.data.secrets || []).map((s: any) => s.secretKey);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  private startRefreshLoop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      const expiredKeys: string[] = [];
      const now = Date.now();

      for (const [key, cached] of this.cache) {
        if (cached.expiresAt <= now) {
          expiredKeys.push(key);
        }
      }

      // Refresh expired secrets in background
      for (const key of expiredKeys) {
        try {
          await this.getSecret(key, { forceRefresh: true });
        } catch (error) {
          logger.warn(`Failed to refresh secret: ${key}`);
        }
      }
    }, this.config?.refreshIntervalMs || 60000);
  }
}

// Export singleton instance
export const externalSecretsService = new ExternalSecretsService();

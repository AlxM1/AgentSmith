/**
 * API Key Service
 * Manages API key generation, validation, and lifecycle
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;  // First 8 chars for identification
  userId: string;
  workspaceId?: string;
  scopes: ApiKeyScope[];
  permissions: ApiKeyPermission[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  expiresAt?: Date;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  usageCount: number;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiKeyScope =
  | 'workflows:read'
  | 'workflows:write'
  | 'workflows:execute'
  | 'executions:read'
  | 'executions:write'
  | 'credentials:read'
  | 'credentials:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'users:read'
  | 'users:write'
  | 'admin:read'
  | 'admin:write'
  | '*';  // Full access

export type ApiKeyPermission = {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'execute')[];
  conditions?: Record<string, any>;
};

export interface CreateApiKeyInput {
  name: string;
  userId: string;
  workspaceId?: string;
  scopes: ApiKeyScope[];
  permissions?: ApiKeyPermission[];
  rateLimit?: ApiKey['rateLimit'];
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
  userId?: string;
  scopes?: ApiKeyScope[];
}

interface RateLimitEntry {
  minute: number;
  hour: number;
  day: number;
  minuteReset: number;
  hourReset: number;
  dayReset: number;
}

class ApiKeyService extends EventEmitter {
  private apiKeys: Map<string, ApiKey> = new Map();
  private keyHashIndex: Map<string, string> = new Map(); // hash -> id
  private rateLimitCache: Map<string, RateLimitEntry> = new Map();

  // Key generation settings
  private readonly KEY_LENGTH = 32;
  private readonly KEY_PREFIX = 'ask_';  // AgentSmith Key
  private readonly HASH_ALGORITHM = 'sha256';

  constructor() {
    super();
  }

  /**
   * Generate a new API key
   */
  async createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
    // Generate random key
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const plainTextKey = this.KEY_PREFIX + randomBytes.toString('base64url');

    // Hash the key for storage
    const keyHash = this.hashKey(plainTextKey);

    // Extract prefix for identification
    const keyPrefix = plainTextKey.substring(0, 12);

    const id = `ak_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const apiKey: ApiKey = {
      id,
      name: input.name,
      keyHash,
      keyPrefix,
      userId: input.userId,
      workspaceId: input.workspaceId,
      scopes: input.scopes,
      permissions: input.permissions || [],
      rateLimit: input.rateLimit,
      expiresAt: input.expiresAt,
      usageCount: 0,
      isActive: true,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    // Store the key
    this.apiKeys.set(id, apiKey);
    this.keyHashIndex.set(keyHash, id);

    this.emit('apiKey:created', { id, name: input.name, userId: input.userId });

    // Return the plain text key only once - it cannot be retrieved again
    return {
      apiKey,
      plainTextKey,
    };
  }

  /**
   * Validate an API key
   */
  async validateKey(plainTextKey: string): Promise<ApiKeyValidationResult> {
    // Basic format check
    if (!plainTextKey || !plainTextKey.startsWith(this.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid key format' };
    }

    // Hash the provided key
    const keyHash = this.hashKey(plainTextKey);

    // Look up by hash
    const keyId = this.keyHashIndex.get(keyHash);
    if (!keyId) {
      return { valid: false, error: 'API key not found' };
    }

    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      return { valid: false, error: 'API key not found' };
    }

    // Check if active
    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is disabled' };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update usage stats
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount++;
    apiKey.updatedAt = new Date();

    this.emit('apiKey:used', { id: apiKey.id, userId: apiKey.userId });

    return {
      valid: true,
      apiKey,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
    };
  }

  /**
   * Check rate limits for an API key
   */
  checkRateLimit(apiKey: ApiKey, clientIp?: string): { allowed: boolean; retryAfter?: number } {
    if (!apiKey.rateLimit) {
      return { allowed: true };
    }

    const now = Date.now();
    const cacheKey = apiKey.id;

    let entry = this.rateLimitCache.get(cacheKey);

    if (!entry) {
      entry = {
        minute: 0,
        hour: 0,
        day: 0,
        minuteReset: now + 60000,
        hourReset: now + 3600000,
        dayReset: now + 86400000,
      };
      this.rateLimitCache.set(cacheKey, entry);
    }

    // Reset counters if windows have passed
    if (now > entry.minuteReset) {
      entry.minute = 0;
      entry.minuteReset = now + 60000;
    }
    if (now > entry.hourReset) {
      entry.hour = 0;
      entry.hourReset = now + 3600000;
    }
    if (now > entry.dayReset) {
      entry.day = 0;
      entry.dayReset = now + 86400000;
    }

    // Check limits
    if (entry.minute >= apiKey.rateLimit.requestsPerMinute) {
      return { allowed: false, retryAfter: Math.ceil((entry.minuteReset - now) / 1000) };
    }
    if (entry.hour >= apiKey.rateLimit.requestsPerHour) {
      return { allowed: false, retryAfter: Math.ceil((entry.hourReset - now) / 1000) };
    }
    if (entry.day >= apiKey.rateLimit.requestsPerDay) {
      return { allowed: false, retryAfter: Math.ceil((entry.dayReset - now) / 1000) };
    }

    // Increment counters
    entry.minute++;
    entry.hour++;
    entry.day++;

    // Update client IP
    if (clientIp) {
      apiKey.lastUsedIp = clientIp;
    }

    return { allowed: true };
  }

  /**
   * Check if an API key has a specific scope
   */
  hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
    // Wildcard grants all access
    if (apiKey.scopes.includes('*')) {
      return true;
    }

    // Direct scope match
    if (apiKey.scopes.includes(requiredScope)) {
      return true;
    }

    // Check for write scope granting read access
    const [resource, action] = requiredScope.split(':');
    if (action === 'read') {
      const writeScope = `${resource}:write` as ApiKeyScope;
      if (apiKey.scopes.includes(writeScope)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an API key has permission for an action
   */
  hasPermission(apiKey: ApiKey, resource: string, action: string): boolean {
    // Check scopes first
    const scopeAction = action === 'create' || action === 'update' || action === 'delete' ? 'write' : 'read';
    const scope = `${resource}:${scopeAction}` as ApiKeyScope;

    if (!this.hasScope(apiKey, scope) && !this.hasScope(apiKey, '*')) {
      return false;
    }

    // Check specific permissions if defined
    if (apiKey.permissions.length > 0) {
      const permission = apiKey.permissions.find(p => p.resource === resource || p.resource === '*');
      if (!permission) {
        return false;
      }
      if (!permission.actions.includes(action as any) && !permission.actions.includes('*' as any)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get an API key by ID
   */
  getApiKey(id: string): ApiKey | undefined {
    return this.apiKeys.get(id);
  }

  /**
   * Get all API keys for a user
   */
  getUserApiKeys(userId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(key => key.userId === userId)
      .map(key => ({
        ...key,
        keyHash: '[REDACTED]', // Never expose the hash
      }));
  }

  /**
   * Get all API keys for a workspace
   */
  getWorkspaceApiKeys(workspaceId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(key => key.workspaceId === workspaceId)
      .map(key => ({
        ...key,
        keyHash: '[REDACTED]',
      }));
  }

  /**
   * Update an API key
   */
  updateApiKey(id: string, updates: Partial<Pick<ApiKey, 'name' | 'scopes' | 'permissions' | 'rateLimit' | 'expiresAt' | 'isActive' | 'metadata'>>): ApiKey | null {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return null;
    }

    const updatedKey: ApiKey = {
      ...apiKey,
      ...updates,
      updatedAt: new Date(),
    };

    this.apiKeys.set(id, updatedKey);
    this.emit('apiKey:updated', { id, updates: Object.keys(updates) });

    return {
      ...updatedKey,
      keyHash: '[REDACTED]',
    };
  }

  /**
   * Revoke/delete an API key
   */
  revokeApiKey(id: string): boolean {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return false;
    }

    // Remove from indexes
    this.keyHashIndex.delete(apiKey.keyHash);
    this.apiKeys.delete(id);
    this.rateLimitCache.delete(id);

    this.emit('apiKey:revoked', { id, userId: apiKey.userId });

    return true;
  }

  /**
   * Disable an API key (soft delete)
   */
  disableApiKey(id: string): ApiKey | null {
    return this.updateApiKey(id, { isActive: false });
  }

  /**
   * Enable an API key
   */
  enableApiKey(id: string): ApiKey | null {
    return this.updateApiKey(id, { isActive: true });
  }

  /**
   * Rotate an API key (generate new key, keep same settings)
   */
  async rotateApiKey(id: string): Promise<{ apiKey: ApiKey; plainTextKey: string } | null> {
    const oldKey = this.apiKeys.get(id);
    if (!oldKey) {
      return null;
    }

    // Create new key with same settings
    const result = await this.createApiKey({
      name: oldKey.name,
      userId: oldKey.userId,
      workspaceId: oldKey.workspaceId,
      scopes: oldKey.scopes,
      permissions: oldKey.permissions,
      rateLimit: oldKey.rateLimit,
      expiresAt: oldKey.expiresAt,
      metadata: {
        ...oldKey.metadata,
        rotatedFrom: id,
        rotatedAt: new Date().toISOString(),
      },
    });

    // Revoke old key
    this.revokeApiKey(id);

    this.emit('apiKey:rotated', { oldId: id, newId: result.apiKey.id });

    return result;
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(plainTextKey: string): string {
    return crypto
      .createHash(this.HASH_ALGORITHM)
      .update(plainTextKey)
      .digest('hex');
  }

  /**
   * Get usage statistics for an API key
   */
  getKeyStats(id: string): {
    usageCount: number;
    lastUsedAt?: Date;
    lastUsedIp?: string;
    rateLimitStatus?: RateLimitEntry;
  } | null {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return null;
    }

    return {
      usageCount: apiKey.usageCount,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      rateLimitStatus: this.rateLimitCache.get(id),
    };
  }

  /**
   * Clean up expired API keys
   */
  cleanupExpiredKeys(): number {
    const now = new Date();
    let count = 0;

    for (const [id, apiKey] of this.apiKeys) {
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        this.revokeApiKey(id);
        count++;
      }
    }

    if (count > 0) {
      this.emit('apiKey:cleanup', { count });
    }

    return count;
  }

  /**
   * List all available scopes
   */
  static getAvailableScopes(): { scope: ApiKeyScope; description: string }[] {
    return [
      { scope: 'workflows:read', description: 'Read workflow definitions' },
      { scope: 'workflows:write', description: 'Create and modify workflows' },
      { scope: 'workflows:execute', description: 'Execute workflows' },
      { scope: 'executions:read', description: 'View execution history and logs' },
      { scope: 'executions:write', description: 'Manage executions (stop, retry)' },
      { scope: 'credentials:read', description: 'View credentials (metadata only)' },
      { scope: 'credentials:write', description: 'Create and modify credentials' },
      { scope: 'webhooks:read', description: 'View webhook configurations' },
      { scope: 'webhooks:write', description: 'Create and modify webhooks' },
      { scope: 'users:read', description: 'View user information' },
      { scope: 'users:write', description: 'Manage users' },
      { scope: 'admin:read', description: 'Read admin settings' },
      { scope: 'admin:write', description: 'Modify admin settings' },
      { scope: '*', description: 'Full access to all resources' },
    ];
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
export default ApiKeyService;

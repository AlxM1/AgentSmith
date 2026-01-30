/**
 * Secrets Rotation Service
 * Automated rotation of credentials, API keys, and tokens
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface SecretConfig {
  id: string;
  name: string;
  type: SecretType;
  rotationDays: number;
  lastRotated?: Date;
  nextRotation?: Date;
  metadata?: Record<string, any>;
  enabled: boolean;
}

export type SecretType =
  | 'database'
  | 'api_key'
  | 'jwt_secret'
  | 'encryption_key'
  | 'oauth_client'
  | 'webhook_secret'
  | 'certificate'
  | 'custom';

export interface RotationResult {
  secretId: string;
  success: boolean;
  rotatedAt: Date;
  error?: string;
  oldValueHash?: string;
  newValueHash?: string;
}

export interface RotationPolicy {
  type: SecretType;
  rotationDays: number;
  gracePeriodHours: number;
  notifyDaysBefore: number[];
  requireApproval: boolean;
}

type RotationHandler = (config: SecretConfig) => Promise<{ newValue: string; metadata?: Record<string, any> }>;

class SecretsRotationService extends EventEmitter {
  private secrets: Map<string, SecretConfig> = new Map();
  private handlers: Map<SecretType, RotationHandler> = new Map();
  private rotationHistory: RotationResult[] = [];
  private rotationTimer: NodeJS.Timeout | null = null;
  private checkIntervalMs = 60 * 60 * 1000; // Check every hour

  private defaultPolicies: Map<SecretType, RotationPolicy> = new Map([
    ['database', { type: 'database', rotationDays: 90, gracePeriodHours: 24, notifyDaysBefore: [30, 7, 1], requireApproval: true }],
    ['api_key', { type: 'api_key', rotationDays: 30, gracePeriodHours: 4, notifyDaysBefore: [7, 1], requireApproval: false }],
    ['jwt_secret', { type: 'jwt_secret', rotationDays: 7, gracePeriodHours: 1, notifyDaysBefore: [3, 1], requireApproval: false }],
    ['encryption_key', { type: 'encryption_key', rotationDays: 365, gracePeriodHours: 48, notifyDaysBefore: [60, 30, 7], requireApproval: true }],
    ['oauth_client', { type: 'oauth_client', rotationDays: 90, gracePeriodHours: 24, notifyDaysBefore: [30, 7, 1], requireApproval: true }],
    ['webhook_secret', { type: 'webhook_secret', rotationDays: 30, gracePeriodHours: 4, notifyDaysBefore: [7, 1], requireApproval: false }],
    ['certificate', { type: 'certificate', rotationDays: 365, gracePeriodHours: 72, notifyDaysBefore: [60, 30, 7, 1], requireApproval: true }],
    ['custom', { type: 'custom', rotationDays: 90, gracePeriodHours: 24, notifyDaysBefore: [30, 7, 1], requireApproval: false }],
  ]);

  constructor() {
    super();
    this.registerDefaultHandlers();
  }

  /**
   * Register default rotation handlers
   */
  private registerDefaultHandlers(): void {
    // API Key rotation
    this.handlers.set('api_key', async (config) => {
      const newKey = this.generateSecureKey(32);
      return { newValue: newKey, metadata: { prefix: newKey.substring(0, 8) } };
    });

    // JWT Secret rotation
    this.handlers.set('jwt_secret', async () => {
      const newSecret = this.generateSecureKey(64);
      return { newValue: newSecret };
    });

    // Encryption key rotation
    this.handlers.set('encryption_key', async () => {
      const newKey = crypto.randomBytes(32).toString('hex');
      return { newValue: newKey };
    });

    // Webhook secret rotation
    this.handlers.set('webhook_secret', async () => {
      const newSecret = this.generateSecureKey(32);
      return { newValue: newSecret };
    });
  }

  /**
   * Generate a secure random key
   */
  private generateSecureKey(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Register a secret for rotation
   */
  registerSecret(config: Omit<SecretConfig, 'nextRotation'>): void {
    const policy = this.defaultPolicies.get(config.type);
    const rotationDays = config.rotationDays || policy?.rotationDays || 90;

    const lastRotated = config.lastRotated || new Date();
    const nextRotation = new Date(lastRotated);
    nextRotation.setDate(nextRotation.getDate() + rotationDays);

    this.secrets.set(config.id, {
      ...config,
      rotationDays,
      lastRotated,
      nextRotation,
    });

    this.emit('secret:registered', { secretId: config.id, nextRotation });
  }

  /**
   * Register a custom rotation handler
   */
  registerHandler(type: SecretType, handler: RotationHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get secret configuration
   */
  getSecret(id: string): SecretConfig | undefined {
    return this.secrets.get(id);
  }

  /**
   * Get all secrets
   */
  getAllSecrets(): SecretConfig[] {
    return Array.from(this.secrets.values());
  }

  /**
   * Get secrets due for rotation
   */
  getSecretsDueForRotation(): SecretConfig[] {
    const now = new Date();
    return this.getAllSecrets().filter(
      (secret) => secret.enabled && secret.nextRotation && secret.nextRotation <= now
    );
  }

  /**
   * Get secrets expiring soon
   */
  getSecretsExpiringSoon(days: number = 7): SecretConfig[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.getAllSecrets().filter(
      (secret) => secret.enabled && secret.nextRotation && secret.nextRotation <= cutoff
    );
  }

  /**
   * Rotate a specific secret
   */
  async rotateSecret(id: string, force: boolean = false): Promise<RotationResult> {
    const secret = this.secrets.get(id);

    if (!secret) {
      return {
        secretId: id,
        success: false,
        rotatedAt: new Date(),
        error: 'Secret not found',
      };
    }

    if (!secret.enabled && !force) {
      return {
        secretId: id,
        success: false,
        rotatedAt: new Date(),
        error: 'Secret rotation is disabled',
      };
    }

    const handler = this.handlers.get(secret.type);
    if (!handler) {
      return {
        secretId: id,
        success: false,
        rotatedAt: new Date(),
        error: `No rotation handler for type: ${secret.type}`,
      };
    }

    try {
      this.emit('rotation:start', { secretId: id, type: secret.type });

      const { newValue, metadata } = await handler(secret);

      // Update secret config
      const now = new Date();
      const nextRotation = new Date(now);
      nextRotation.setDate(nextRotation.getDate() + secret.rotationDays);

      const updatedSecret: SecretConfig = {
        ...secret,
        lastRotated: now,
        nextRotation,
        metadata: { ...secret.metadata, ...metadata },
      };

      this.secrets.set(id, updatedSecret);

      const result: RotationResult = {
        secretId: id,
        success: true,
        rotatedAt: now,
        newValueHash: crypto.createHash('sha256').update(newValue).digest('hex').substring(0, 16),
      };

      this.rotationHistory.push(result);
      this.emit('rotation:success', { secretId: id, nextRotation, newValueHash: result.newValueHash });

      // Emit the new value for the caller to handle storage
      this.emit('rotation:newValue', { secretId: id, value: newValue, metadata });

      return result;
    } catch (error: any) {
      const result: RotationResult = {
        secretId: id,
        success: false,
        rotatedAt: new Date(),
        error: error.message,
      };

      this.rotationHistory.push(result);
      this.emit('rotation:failure', { secretId: id, error: error.message });

      return result;
    }
  }

  /**
   * Rotate all secrets due for rotation
   */
  async rotateAllDue(): Promise<RotationResult[]> {
    const dueSecrets = this.getSecretsDueForRotation();
    const results: RotationResult[] = [];

    for (const secret of dueSecrets) {
      const result = await this.rotateSecret(secret.id);
      results.push(result);
    }

    return results;
  }

  /**
   * Start the automatic rotation scheduler
   */
  startScheduler(): void {
    if (this.rotationTimer) {
      return;
    }

    this.rotationTimer = setInterval(() => {
      this.checkAndRotate();
    }, this.checkIntervalMs);

    // Initial check
    this.checkAndRotate();
    this.emit('scheduler:started', { intervalMs: this.checkIntervalMs });
  }

  /**
   * Stop the automatic rotation scheduler
   */
  stopScheduler(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      this.emit('scheduler:stopped', {});
    }
  }

  /**
   * Check for secrets needing rotation and send notifications
   */
  private async checkAndRotate(): Promise<void> {
    // Check for expiring secrets and send notifications
    for (const [days, label] of [[30, '30 days'], [7, '7 days'], [1, '1 day']] as const) {
      const expiring = this.getSecretsExpiringSoon(days);
      for (const secret of expiring) {
        const daysUntil = Math.ceil(
          (secret.nextRotation!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil === days) {
          this.emit('rotation:warning', {
            secretId: secret.id,
            name: secret.name,
            daysUntilRotation: daysUntil,
          });
        }
      }
    }

    // Auto-rotate secrets that don't require approval
    const dueSecrets = this.getSecretsDueForRotation();
    for (const secret of dueSecrets) {
      const policy = this.defaultPolicies.get(secret.type);
      if (policy && !policy.requireApproval) {
        await this.rotateSecret(secret.id);
      } else {
        this.emit('rotation:approvalRequired', {
          secretId: secret.id,
          name: secret.name,
          type: secret.type,
        });
      }
    }
  }

  /**
   * Get rotation history
   */
  getRotationHistory(limit: number = 100): RotationResult[] {
    return this.rotationHistory.slice(-limit);
  }

  /**
   * Get rotation history for a specific secret
   */
  getSecretRotationHistory(secretId: string): RotationResult[] {
    return this.rotationHistory.filter((r) => r.secretId === secretId);
  }

  /**
   * Update secret configuration
   */
  updateSecret(id: string, updates: Partial<SecretConfig>): SecretConfig | null {
    const secret = this.secrets.get(id);
    if (!secret) {
      return null;
    }

    const updated = { ...secret, ...updates, id };

    // Recalculate next rotation if rotation days changed
    if (updates.rotationDays && secret.lastRotated) {
      updated.nextRotation = new Date(secret.lastRotated);
      updated.nextRotation.setDate(updated.nextRotation.getDate() + updates.rotationDays);
    }

    this.secrets.set(id, updated);
    return updated;
  }

  /**
   * Remove a secret from rotation
   */
  removeSecret(id: string): boolean {
    return this.secrets.delete(id);
  }

  /**
   * Get rotation policy for a secret type
   */
  getPolicy(type: SecretType): RotationPolicy | undefined {
    return this.defaultPolicies.get(type);
  }

  /**
   * Update rotation policy
   */
  updatePolicy(type: SecretType, policy: Partial<RotationPolicy>): void {
    const existing = this.defaultPolicies.get(type);
    if (existing) {
      this.defaultPolicies.set(type, { ...existing, ...policy });
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSecrets: number;
    enabledSecrets: number;
    dueForRotation: number;
    expiringSoon: number;
    successfulRotations: number;
    failedRotations: number;
  } {
    const history = this.rotationHistory;
    return {
      totalSecrets: this.secrets.size,
      enabledSecrets: this.getAllSecrets().filter((s) => s.enabled).length,
      dueForRotation: this.getSecretsDueForRotation().length,
      expiringSoon: this.getSecretsExpiringSoon(7).length,
      successfulRotations: history.filter((r) => r.success).length,
      failedRotations: history.filter((r) => !r.success).length,
    };
  }
}

// Export singleton instance
export const secretsRotation = new SecretsRotationService();

export default SecretsRotationService;

// ============================================
// Kubernetes Integration
// ============================================

export interface K8sSecretRotationConfig {
  namespace: string;
  secretName: string;
  key: string;
  type: SecretType;
  rotationDays: number;
}

/**
 * Kubernetes Secret Rotation Integration
 * Use with Kubernetes external-secrets or similar operators
 */
export class K8sSecretsRotator {
  private kubeClient: any; // Would be @kubernetes/client-node in real implementation

  constructor(kubeConfig?: any) {
    // Initialize Kubernetes client
    // In production, use @kubernetes/client-node
  }

  /**
   * Create rotation handler for Kubernetes secrets
   */
  createK8sHandler(config: K8sSecretRotationConfig): RotationHandler {
    return async (secretConfig) => {
      const newValue = crypto.randomBytes(32).toString('base64');

      // In production, this would update the Kubernetes secret
      // await this.kubeClient.patchNamespacedSecret(...)

      return {
        newValue,
        metadata: {
          namespace: config.namespace,
          secretName: config.secretName,
          key: config.key,
          updatedAt: new Date().toISOString(),
        },
      };
    };
  }
}

// ============================================
// Database Credential Rotation
// ============================================

export interface DatabaseRotationConfig {
  host: string;
  port: number;
  adminUser: string;
  adminPassword: string;
  database: string;
  targetUser: string;
}

/**
 * Database credential rotation handler
 */
export function createDatabaseRotationHandler(config: DatabaseRotationConfig): RotationHandler {
  return async () => {
    // Generate new password
    const newPassword = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '');

    // In production, this would:
    // 1. Connect to database as admin
    // 2. ALTER USER targetUser WITH PASSWORD 'newPassword'
    // 3. Verify connection with new password
    // 4. Update application configuration

    return {
      newValue: newPassword,
      metadata: {
        database: config.database,
        user: config.targetUser,
        rotatedAt: new Date().toISOString(),
      },
    };
  };
}

// ============================================
// AWS Secrets Manager Integration
// ============================================

export interface AWSSecretsConfig {
  region: string;
  secretId: string;
}

/**
 * AWS Secrets Manager rotation handler
 */
export function createAWSSecretsHandler(config: AWSSecretsConfig): RotationHandler {
  return async () => {
    // In production, use AWS SDK:
    // const client = new SecretsManagerClient({ region: config.region });
    // await client.send(new RotateSecretCommand({ SecretId: config.secretId }));

    const newValue = crypto.randomBytes(32).toString('hex');

    return {
      newValue,
      metadata: {
        awsSecretId: config.secretId,
        region: config.region,
      },
    };
  };
}

// ============================================
// HashiCorp Vault Integration
// ============================================

export interface VaultConfig {
  address: string;
  token: string;
  path: string;
}

/**
 * HashiCorp Vault rotation handler
 */
export function createVaultHandler(config: VaultConfig): RotationHandler {
  return async () => {
    // In production, use node-vault:
    // const vault = require('node-vault')({ apiVersion: 'v1', endpoint: config.address, token: config.token });
    // const response = await vault.write(config.path, { ... });

    const newValue = crypto.randomBytes(32).toString('hex');

    return {
      newValue,
      metadata: {
        vaultPath: config.path,
      },
    };
  };
}

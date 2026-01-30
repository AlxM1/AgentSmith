/**
 * Environment Management Service
 *
 * Enterprise feature for multi-environment workflow deployment:
 * - Development, Staging, Production environments
 * - Environment-specific variables
 * - Promotion workflows between environments
 * - Rollback capabilities
 */

import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { eq, and, desc } from 'drizzle-orm';
import { workflows, workflowVersions, variables, auditLogs } from '../db/schema.js';
import type { IWorkflow } from '@agentsmith/shared';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type EnvironmentType = 'development' | 'staging' | 'production';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string;
  color: string;
  isDefault: boolean;
  isProtected: boolean;
  variables: EnvironmentVariable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
  environment: string;
}

export interface EnvironmentWorkflow {
  workflowId: string;
  environment: string;
  version: number;
  status: 'active' | 'inactive' | 'pending';
  deployedAt: Date;
  deployedBy: string;
  previousVersion?: number;
}

export interface PromotionRequest {
  workflowId: string;
  fromEnvironment: string;
  toEnvironment: string;
  version?: number;
  userId: string;
  comment?: string;
}

export interface PromotionResult {
  success: boolean;
  workflowId: string;
  fromVersion: number;
  toVersion: number;
  fromEnvironment: string;
  toEnvironment: string;
  promotionId: string;
  errors?: string[];
}

export interface RollbackRequest {
  workflowId: string;
  environment: string;
  targetVersion: number;
  userId: string;
  reason?: string;
}

// ============================================================================
// DEFAULT ENVIRONMENTS
// ============================================================================

const DEFAULT_ENVIRONMENTS: Omit<Environment, 'id' | 'variables' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Development',
    type: 'development',
    description: 'Development and testing environment',
    color: '#10B981',
    isDefault: true,
    isProtected: false,
  },
  {
    name: 'Staging',
    type: 'staging',
    description: 'Pre-production testing environment',
    color: '#F59E0B',
    isDefault: false,
    isProtected: true,
  },
  {
    name: 'Production',
    type: 'production',
    description: 'Live production environment',
    color: '#EF4444',
    isDefault: false,
    isProtected: true,
  },
];

// ============================================================================
// IN-MEMORY STORAGE (Replace with DB tables in production)
// ============================================================================

// Stored in memory for simplicity - in production, these would be DB tables
const environmentStore: Map<string, Environment> = new Map();
const environmentWorkflows: Map<string, EnvironmentWorkflow> = new Map();
const promotionHistory: Map<string, PromotionResult[]> = new Map();

// ============================================================================
// ENVIRONMENT SERVICE
// ============================================================================

class EnvironmentService {
  private isInitialized = false;

  /**
   * Initialize environment service with default environments
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create default environments
    for (const env of DEFAULT_ENVIRONMENTS) {
      const id = `env_${env.type}`;
      environmentStore.set(id, {
        ...env,
        id,
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    this.isInitialized = true;
    logger.info('Environment service initialized', {
      environments: Array.from(environmentStore.keys()),
    });
  }

  /**
   * Get all environments
   */
  getEnvironments(): Environment[] {
    return Array.from(environmentStore.values());
  }

  /**
   * Get environment by ID or type
   */
  getEnvironment(idOrType: string): Environment | undefined {
    // Try by ID first
    let env = environmentStore.get(idOrType);
    if (env) return env;

    // Try by type
    for (const e of environmentStore.values()) {
      if (e.type === idOrType) return e;
    }

    return undefined;
  }

  /**
   * Create a new environment
   */
  async createEnvironment(data: {
    name: string;
    type: EnvironmentType;
    description?: string;
    color?: string;
    isProtected?: boolean;
  }): Promise<Environment> {
    const id = `env_${crypto.randomUUID().substring(0, 8)}`;

    const environment: Environment = {
      id,
      name: data.name,
      type: data.type,
      description: data.description,
      color: data.color || '#6B7280',
      isDefault: false,
      isProtected: data.isProtected ?? false,
      variables: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    environmentStore.set(id, environment);

    logger.info('Created environment', { id, name: data.name, type: data.type });

    return environment;
  }

  /**
   * Update environment
   */
  async updateEnvironment(
    id: string,
    updates: Partial<Pick<Environment, 'name' | 'description' | 'color' | 'isProtected'>>
  ): Promise<Environment | null> {
    const env = environmentStore.get(id);
    if (!env) return null;

    const updated: Environment = {
      ...env,
      ...updates,
      updatedAt: new Date(),
    };

    environmentStore.set(id, updated);

    logger.info('Updated environment', { id });

    return updated;
  }

  /**
   * Delete environment
   */
  async deleteEnvironment(id: string): Promise<boolean> {
    const env = environmentStore.get(id);
    if (!env) return false;

    if (env.isDefault) {
      throw new Error('Cannot delete default environment');
    }

    environmentStore.delete(id);
    logger.info('Deleted environment', { id });

    return true;
  }

  // ============================================================================
  // ENVIRONMENT VARIABLES
  // ============================================================================

  /**
   * Set environment variable
   */
  async setVariable(
    environmentId: string,
    key: string,
    value: string,
    isSecret: boolean = false
  ): Promise<EnvironmentVariable> {
    const env = environmentStore.get(environmentId);
    if (!env) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    // Remove existing variable with same key
    env.variables = env.variables.filter((v) => v.key !== key);

    const variable: EnvironmentVariable = {
      key,
      value: isSecret ? this.encryptValue(value) : value,
      isSecret,
      environment: environmentId,
    };

    env.variables.push(variable);
    env.updatedAt = new Date();

    // Also store in database variables table
    const varId = `var_${environmentId}_${key}`;
    try {
      await db
        .insert(variables)
        .values({
          id: varId,
          key: `${environmentId}:${key}`,
          value: variable.value,
          type: isSecret ? 'secret' : 'string',
        })
        .onConflictDoUpdate({
          target: variables.key,
          set: { value: variable.value, type: isSecret ? 'secret' : 'string' },
        });
    } catch (error) {
      logger.warn('Failed to persist environment variable to database', { error });
    }

    logger.info('Set environment variable', {
      environment: environmentId,
      key,
      isSecret,
    });

    return {
      ...variable,
      value: isSecret ? '********' : value,
    };
  }

  /**
   * Get environment variable
   */
  getVariable(environmentId: string, key: string): string | undefined {
    const env = environmentStore.get(environmentId);
    if (!env) return undefined;

    const variable = env.variables.find((v) => v.key === key);
    if (!variable) return undefined;

    return variable.isSecret ? this.decryptValue(variable.value) : variable.value;
  }

  /**
   * Get all variables for environment
   */
  getVariables(environmentId: string, includeSecrets: boolean = false): EnvironmentVariable[] {
    const env = environmentStore.get(environmentId);
    if (!env) return [];

    return env.variables.map((v) => ({
      ...v,
      value: v.isSecret && !includeSecrets ? '********' : v.isSecret ? this.decryptValue(v.value) : v.value,
    }));
  }

  /**
   * Delete environment variable
   */
  async deleteVariable(environmentId: string, key: string): Promise<boolean> {
    const env = environmentStore.get(environmentId);
    if (!env) return false;

    const originalLength = env.variables.length;
    env.variables = env.variables.filter((v) => v.key !== key);

    if (env.variables.length === originalLength) {
      return false;
    }

    env.updatedAt = new Date();

    logger.info('Deleted environment variable', { environment: environmentId, key });

    return true;
  }

  // ============================================================================
  // WORKFLOW PROMOTION
  // ============================================================================

  /**
   * Promote workflow to another environment
   */
  async promoteWorkflow(request: PromotionRequest): Promise<PromotionResult> {
    const fromEnv = this.getEnvironment(request.fromEnvironment);
    const toEnv = this.getEnvironment(request.toEnvironment);

    if (!fromEnv || !toEnv) {
      return {
        success: false,
        workflowId: request.workflowId,
        fromVersion: 0,
        toVersion: 0,
        fromEnvironment: request.fromEnvironment,
        toEnvironment: request.toEnvironment,
        promotionId: '',
        errors: ['Invalid source or target environment'],
      };
    }

    // Validate promotion path
    const validPromotionPaths: Record<EnvironmentType, EnvironmentType[]> = {
      development: ['staging'],
      staging: ['production'],
      production: [],
    };

    if (!validPromotionPaths[fromEnv.type].includes(toEnv.type)) {
      return {
        success: false,
        workflowId: request.workflowId,
        fromVersion: 0,
        toVersion: 0,
        fromEnvironment: request.fromEnvironment,
        toEnvironment: request.toEnvironment,
        promotionId: '',
        errors: [`Cannot promote directly from ${fromEnv.type} to ${toEnv.type}`],
      };
    }

    try {
      // Get workflow
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, request.workflowId),
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Get version to promote
      const version = request.version || workflow.versionId || 1;

      // Create new version in target environment
      const newVersion = await this.createEnvironmentVersion(
        request.workflowId,
        workflow as unknown as IWorkflow,
        toEnv.id,
        version,
        request.userId
      );

      const promotionId = `promo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const result: PromotionResult = {
        success: true,
        workflowId: request.workflowId,
        fromVersion: version,
        toVersion: newVersion,
        fromEnvironment: fromEnv.id,
        toEnvironment: toEnv.id,
        promotionId,
      };

      // Store promotion history
      const history = promotionHistory.get(request.workflowId) || [];
      history.push(result);
      promotionHistory.set(request.workflowId, history);

      // Log audit event
      await this.logAuditEvent({
        userId: request.userId,
        action: 'workflow.promote',
        resourceType: 'workflow',
        resourceId: request.workflowId,
        details: {
          fromEnvironment: fromEnv.name,
          toEnvironment: toEnv.name,
          fromVersion: version,
          toVersion: newVersion,
          comment: request.comment,
        },
      });

      logger.info('Workflow promoted', {
        workflowId: request.workflowId,
        from: fromEnv.type,
        to: toEnv.type,
        version: newVersion,
      });

      return result;
    } catch (error: any) {
      return {
        success: false,
        workflowId: request.workflowId,
        fromVersion: 0,
        toVersion: 0,
        fromEnvironment: request.fromEnvironment,
        toEnvironment: request.toEnvironment,
        promotionId: '',
        errors: [error.message],
      };
    }
  }

  /**
   * Rollback workflow to previous version
   */
  async rollbackWorkflow(request: RollbackRequest): Promise<PromotionResult> {
    try {
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, request.workflowId),
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Get target version
      const targetVersionRecord = await db.query.workflowVersions.findFirst({
        where: and(
          eq(workflowVersions.workflowId, request.workflowId),
          eq(workflowVersions.versionNumber, request.targetVersion)
        ),
      });

      if (!targetVersionRecord) {
        throw new Error(`Version ${request.targetVersion} not found`);
      }

      const currentVersion = workflow.versionId || 1;

      // Restore workflow to target version
      await db
        .update(workflows)
        .set({
          nodes: targetVersionRecord.nodes,
          connections: targetVersionRecord.connections,
          settings: targetVersionRecord.settings,
          versionId: currentVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, request.workflowId));

      // Create rollback version record
      await db.insert(workflowVersions).values({
        id: `wfv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        workflowId: request.workflowId,
        versionNumber: currentVersion + 1,
        name: workflow.name,
        description: workflow.description,
        nodes: targetVersionRecord.nodes,
        connections: targetVersionRecord.connections,
        settings: targetVersionRecord.settings,
        active: workflow.active,
        createdBy: request.userId,
        comment: `Rollback to version ${request.targetVersion}: ${request.reason || 'No reason provided'}`,
      });

      const rollbackId = `rollback_${Date.now()}`;

      // Log audit event
      await this.logAuditEvent({
        userId: request.userId,
        action: 'workflow.rollback',
        resourceType: 'workflow',
        resourceId: request.workflowId,
        details: {
          environment: request.environment,
          fromVersion: currentVersion,
          toVersion: request.targetVersion,
          newVersion: currentVersion + 1,
          reason: request.reason,
        },
      });

      logger.info('Workflow rolled back', {
        workflowId: request.workflowId,
        fromVersion: currentVersion,
        toVersion: request.targetVersion,
      });

      return {
        success: true,
        workflowId: request.workflowId,
        fromVersion: currentVersion,
        toVersion: currentVersion + 1,
        fromEnvironment: request.environment,
        toEnvironment: request.environment,
        promotionId: rollbackId,
      };
    } catch (error: any) {
      return {
        success: false,
        workflowId: request.workflowId,
        fromVersion: 0,
        toVersion: 0,
        fromEnvironment: request.environment,
        toEnvironment: request.environment,
        promotionId: '',
        errors: [error.message],
      };
    }
  }

  /**
   * Get promotion history for a workflow
   */
  getPromotionHistory(workflowId: string): PromotionResult[] {
    return promotionHistory.get(workflowId) || [];
  }

  /**
   * Get workflow deployment status across environments
   */
  async getDeploymentStatus(workflowId: string): Promise<Map<string, EnvironmentWorkflow>> {
    const status = new Map<string, EnvironmentWorkflow>();

    for (const [envId, env] of environmentStore) {
      const key = `${workflowId}:${envId}`;
      const deployment = environmentWorkflows.get(key);

      if (deployment) {
        status.set(envId, deployment);
      }
    }

    return status;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async createEnvironmentVersion(
    workflowId: string,
    workflow: IWorkflow,
    environmentId: string,
    fromVersion: number,
    userId: string
  ): Promise<number> {
    // Get latest version number
    const latestVersion = await db.query.workflowVersions.findFirst({
      where: eq(workflowVersions.workflowId, workflowId),
      orderBy: [desc(workflowVersions.versionNumber)],
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create version record
    await db.insert(workflowVersions).values({
      id: `wfv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workflowId,
      versionNumber: newVersionNumber,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes as any,
      connections: workflow.connections as any,
      settings: workflow.settings as any,
      active: workflow.active,
      createdBy: userId,
      comment: `Promoted to ${environmentId} from version ${fromVersion}`,
    });

    // Update environment deployment record
    const key = `${workflowId}:${environmentId}`;
    const existingDeployment = environmentWorkflows.get(key);

    environmentWorkflows.set(key, {
      workflowId,
      environment: environmentId,
      version: newVersionNumber,
      status: 'active',
      deployedAt: new Date(),
      deployedBy: userId,
      previousVersion: existingDeployment?.version,
    });

    return newVersionNumber;
  }

  private encryptValue(value: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32chars!!';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.padEnd(32).substring(0, 32)), iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptValue(encrypted: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32chars!!';
    const [ivHex, authTagHex, encryptedData] = encrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key.padEnd(32).substring(0, 32)), iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async logAuditEvent(event: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        userId: event.userId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        details: event.details,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.warn('Failed to log audit event', { error });
    }
  }
}

// Export singleton instance
export const environmentService = new EnvironmentService();

// @ts-nocheck
/**
 * Feature Flags Service
 * Provides feature toggle functionality for gradual rollouts and A/B testing
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: FlagType;
  value: FlagValue;
  defaultValue: FlagValue;
  rules: FlagRule[];
  variants?: FlagVariant[];
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type FlagType = 'boolean' | 'string' | 'number' | 'json' | 'percentage';

export type FlagValue = boolean | string | number | Record<string, any>;

export interface FlagRule {
  id: string;
  priority: number;
  conditions: FlagCondition[];
  value: FlagValue;
  percentage?: number;  // For gradual rollouts
  enabled: boolean;
}

export interface FlagCondition {
  attribute: string;  // e.g., 'userId', 'email', 'plan', 'country'
  operator: ConditionOperator;
  value: any;
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'in'
  | 'notIn'
  | 'matches'  // regex
  | 'semverGreaterThan'
  | 'semverLessThan';

export interface FlagVariant {
  key: string;
  name: string;
  value: FlagValue;
  weight: number;  // Percentage weight for distribution
}

export interface EvaluationContext {
  userId?: string;
  email?: string;
  plan?: string;
  role?: string;
  country?: string;
  userAgent?: string;
  version?: string;
  workspaceId?: string;
  attributes?: Record<string, any>;
}

export interface EvaluationResult {
  key: string;
  value: FlagValue;
  variant?: string;
  reason: EvaluationReason;
  ruleId?: string;
}

export type EvaluationReason =
  | 'FLAG_DISABLED'
  | 'DEFAULT_VALUE'
  | 'RULE_MATCH'
  | 'PERCENTAGE_ROLLOUT'
  | 'VARIANT_ASSIGNMENT'
  | 'ERROR';

class FeatureFlagsService extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private overrides: Map<string, Map<string, FlagValue>> = new Map();  // userId -> flagKey -> value
  private evaluationCache: Map<string, EvaluationResult> = new Map();
  private cacheEnabled = true;
  private cacheTTL = 60000;  // 1 minute

  constructor() {
    super();
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaults: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        key: 'new_workflow_editor',
        name: 'New Workflow Editor',
        description: 'Enable the new drag-and-drop workflow editor',
        enabled: false,
        type: 'boolean',
        value: false,
        defaultValue: false,
        rules: [],
        tags: ['frontend', 'beta'],
      },
      {
        key: 'ai_suggestions',
        name: 'AI Suggestions',
        description: 'Enable AI-powered workflow suggestions',
        enabled: false,
        type: 'boolean',
        value: false,
        defaultValue: false,
        rules: [
          {
            id: 'enterprise-only',
            priority: 1,
            conditions: [{ attribute: 'plan', operator: 'equals', value: 'enterprise' }],
            value: true,
            enabled: true,
          },
        ],
        tags: ['ai', 'enterprise'],
      },
      {
        key: 'execution_timeout',
        name: 'Execution Timeout',
        description: 'Maximum workflow execution timeout in seconds',
        enabled: true,
        type: 'number',
        value: 300,
        defaultValue: 300,
        rules: [
          {
            id: 'enterprise-extended',
            priority: 1,
            conditions: [{ attribute: 'plan', operator: 'equals', value: 'enterprise' }],
            value: 3600,
            enabled: true,
          },
          {
            id: 'business-extended',
            priority: 2,
            conditions: [{ attribute: 'plan', operator: 'equals', value: 'business' }],
            value: 600,
            enabled: true,
          },
        ],
        tags: ['limits'],
      },
      {
        key: 'dark_mode',
        name: 'Dark Mode',
        description: 'Enable dark mode UI',
        enabled: true,
        type: 'boolean',
        value: true,
        defaultValue: true,
        rules: [],
        tags: ['frontend', 'ui'],
      },
      {
        key: 'api_rate_limit',
        name: 'API Rate Limit',
        description: 'Requests per minute limit',
        enabled: true,
        type: 'number',
        value: 100,
        defaultValue: 100,
        rules: [
          {
            id: 'enterprise-unlimited',
            priority: 1,
            conditions: [{ attribute: 'plan', operator: 'equals', value: 'enterprise' }],
            value: 10000,
            enabled: true,
          },
        ],
        tags: ['limits', 'api'],
      },
      {
        key: 'beta_features',
        name: 'Beta Features',
        description: 'Enable beta features for testing',
        enabled: true,
        type: 'percentage',
        value: 10,  // 10% of users
        defaultValue: 0,
        rules: [
          {
            id: 'internal-users',
            priority: 1,
            conditions: [{ attribute: 'email', operator: 'endsWith', value: '@agentsmith.io' }],
            value: true,
            percentage: 100,
            enabled: true,
          },
        ],
        tags: ['beta'],
      },
    ];

    for (const flag of defaults) {
      this.createFlag(flag);
    }
  }

  /**
   * Create a new feature flag
   */
  createFlag(input: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag {
    const id = `ff_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const flag: FeatureFlag = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.flags.set(flag.key, flag);
    this.invalidateCache(flag.key);
    this.emit('flag:created', { key: flag.key });

    return flag;
  }

  /**
   * Update a feature flag
   */
  updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;

    const updated: FeatureFlag = {
      ...flag,
      ...updates,
      key: flag.key,  // Can't change key
      id: flag.id,
      createdAt: flag.createdAt,
      updatedAt: new Date(),
    };

    this.flags.set(key, updated);
    this.invalidateCache(key);
    this.emit('flag:updated', { key, changes: Object.keys(updates) });

    return updated;
  }

  /**
   * Delete a feature flag
   */
  deleteFlag(key: string): boolean {
    const deleted = this.flags.delete(key);
    if (deleted) {
      this.invalidateCache(key);
      this.emit('flag:deleted', { key });
    }
    return deleted;
  }

  /**
   * Get a feature flag
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flags by tag
   */
  getFlagsByTag(tag: string): FeatureFlag[] {
    return this.getAllFlags().filter(f => f.tags?.includes(tag));
  }

  /**
   * Evaluate a feature flag for a given context
   */
  evaluate(key: string, context: EvaluationContext = {}): EvaluationResult {
    // Check cache first
    const cacheKey = this.getCacheKey(key, context);
    if (this.cacheEnabled) {
      const cached = this.evaluationCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const flag = this.flags.get(key);

    // Flag doesn't exist
    if (!flag) {
      return {
        key,
        value: false,
        reason: 'ERROR',
      };
    }

    // Flag is disabled globally
    if (!flag.enabled) {
      return this.cacheResult(cacheKey, {
        key,
        value: flag.defaultValue,
        reason: 'FLAG_DISABLED',
      });
    }

    // Check user-specific override
    if (context.userId) {
      const userOverrides = this.overrides.get(context.userId);
      if (userOverrides?.has(key)) {
        return this.cacheResult(cacheKey, {
          key,
          value: userOverrides.get(key)!,
          reason: 'RULE_MATCH',
          ruleId: 'user-override',
        });
      }
    }

    // Evaluate rules in priority order
    const sortedRules = [...flag.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      if (this.evaluateConditions(rule.conditions, context)) {
        // Check percentage rollout
        if (rule.percentage !== undefined && rule.percentage < 100) {
          if (!this.isInPercentage(context.userId || '', key, rule.percentage)) {
            continue;
          }
        }

        return this.cacheResult(cacheKey, {
          key,
          value: rule.value,
          reason: rule.percentage !== undefined ? 'PERCENTAGE_ROLLOUT' : 'RULE_MATCH',
          ruleId: rule.id,
        });
      }
    }

    // Handle percentage type flags
    if (flag.type === 'percentage' && typeof flag.value === 'number') {
      const inPercentage = this.isInPercentage(context.userId || '', key, flag.value);
      return this.cacheResult(cacheKey, {
        key,
        value: inPercentage,
        reason: 'PERCENTAGE_ROLLOUT',
      });
    }

    // Handle variant flags
    if (flag.variants && flag.variants.length > 0) {
      const variant = this.selectVariant(context.userId || '', flag.variants);
      return this.cacheResult(cacheKey, {
        key,
        value: variant.value,
        variant: variant.key,
        reason: 'VARIANT_ASSIGNMENT',
      });
    }

    // Return default value
    return this.cacheResult(cacheKey, {
      key,
      value: flag.value,
      reason: 'DEFAULT_VALUE',
    });
  }

  /**
   * Check if a boolean flag is enabled
   */
  isEnabled(key: string, context: EvaluationContext = {}): boolean {
    const result = this.evaluate(key, context);
    return result.value === true;
  }

  /**
   * Get string value of a flag
   */
  getString(key: string, context: EvaluationContext = {}, defaultValue = ''): string {
    const result = this.evaluate(key, context);
    return typeof result.value === 'string' ? result.value : defaultValue;
  }

  /**
   * Get number value of a flag
   */
  getNumber(key: string, context: EvaluationContext = {}, defaultValue = 0): number {
    const result = this.evaluate(key, context);
    return typeof result.value === 'number' ? result.value : defaultValue;
  }

  /**
   * Get JSON value of a flag
   */
  getJSON<T>(key: string, context: EvaluationContext = {}, defaultValue: T): T {
    const result = this.evaluate(key, context);
    return typeof result.value === 'object' ? (result.value as T) : defaultValue;
  }

  /**
   * Set user-specific override
   */
  setOverride(userId: string, key: string, value: FlagValue): void {
    if (!this.overrides.has(userId)) {
      this.overrides.set(userId, new Map());
    }
    this.overrides.get(userId)!.set(key, value);
    this.invalidateCacheForUser(userId);
    this.emit('override:set', { userId, key, value });
  }

  /**
   * Remove user-specific override
   */
  removeOverride(userId: string, key: string): boolean {
    const userOverrides = this.overrides.get(userId);
    if (!userOverrides) return false;

    const deleted = userOverrides.delete(key);
    if (deleted) {
      this.invalidateCacheForUser(userId);
      this.emit('override:removed', { userId, key });
    }
    return deleted;
  }

  /**
   * Get all overrides for a user
   */
  getUserOverrides(userId: string): Record<string, FlagValue> {
    const userOverrides = this.overrides.get(userId);
    if (!userOverrides) return {};

    return Object.fromEntries(userOverrides);
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(conditions: FlagCondition[], context: EvaluationContext): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;  // All conditions must match (AND)
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: FlagCondition, context: EvaluationContext): boolean {
    const contextValue = this.getContextValue(condition.attribute, context);

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'notEquals':
        return contextValue !== condition.value;
      case 'contains':
        return String(contextValue).includes(String(condition.value));
      case 'notContains':
        return !String(contextValue).includes(String(condition.value));
      case 'startsWith':
        return String(contextValue).startsWith(String(condition.value));
      case 'endsWith':
        return String(contextValue).endsWith(String(condition.value));
      case 'greaterThan':
        return Number(contextValue) > Number(condition.value);
      case 'lessThan':
        return Number(contextValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'notIn':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      case 'matches':
        try {
          return new RegExp(condition.value).test(String(contextValue));
        } catch {
          return false;
        }
      case 'semverGreaterThan':
        return this.compareSemver(String(contextValue), String(condition.value)) > 0;
      case 'semverLessThan':
        return this.compareSemver(String(contextValue), String(condition.value)) < 0;
      default:
        return false;
    }
  }

  /**
   * Get value from context
   */
  private getContextValue(attribute: string, context: EvaluationContext): any {
    if (attribute in context) {
      return (context as any)[attribute];
    }
    return context.attributes?.[attribute];
  }

  /**
   * Check if user is in percentage bucket
   */
  private isInPercentage(userId: string, flagKey: string, percentage: number): boolean {
    if (!userId) {
      // Random for anonymous users
      return Math.random() * 100 < percentage;
    }

    // Deterministic hash for consistent results
    const hash = crypto
      .createHash('md5')
      .update(`${userId}:${flagKey}`)
      .digest('hex');

    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    return bucket < percentage;
  }

  /**
   * Select variant based on weights
   */
  private selectVariant(userId: string, variants: FlagVariant[]): FlagVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

    // Get deterministic bucket
    const hash = crypto
      .createHash('md5')
      .update(userId || Math.random().toString())
      .digest('hex');

    const bucket = (parseInt(hash.substring(0, 8), 16) % totalWeight);

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant;
      }
    }

    return variants[0];  // Fallback
  }

  /**
   * Compare semver versions
   */
  private compareSemver(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }

  /**
   * Cache helpers
   */
  private getCacheKey(key: string, context: EvaluationContext): string {
    return `${key}:${JSON.stringify(context)}`;
  }

  private cacheResult(cacheKey: string, result: EvaluationResult): EvaluationResult {
    if (this.cacheEnabled) {
      this.evaluationCache.set(cacheKey, result);
      setTimeout(() => this.evaluationCache.delete(cacheKey), this.cacheTTL);
    }
    return result;
  }

  private invalidateCache(key: string): void {
    for (const cacheKey of this.evaluationCache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.evaluationCache.delete(cacheKey);
      }
    }
  }

  private invalidateCacheForUser(userId: string): void {
    for (const cacheKey of this.evaluationCache.keys()) {
      if (cacheKey.includes(`"userId":"${userId}"`)) {
        this.evaluationCache.delete(cacheKey);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Export flags for client-side SDK
   */
  exportForClient(context: EvaluationContext): Record<string, FlagValue> {
    const result: Record<string, FlagValue> = {};

    for (const flag of this.flags.values()) {
      // Only export client-safe flags
      if (!flag.tags?.includes('server-only')) {
        result[flag.key] = this.evaluate(flag.key, context).value;
      }
    }

    return result;
  }
}

// Export singleton
export const featureFlags = new FeatureFlagsService();
export default FeatureFlagsService;

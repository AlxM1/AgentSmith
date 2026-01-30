/**
 * Feature Flags Routes
 * API endpoints for managing and evaluating feature flags
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { featureFlags } from '../services/FeatureFlags.js';

const router = Router();

// ============ Public Endpoints ============

/**
 * Evaluate flags for current user
 */
router.get('/evaluate', authenticate, async (req: Request, res: Response) => {
  try {
    const context = {
      userId: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      plan: (req as any).workspace?.plan,
      workspaceId: req.headers['x-workspace-id'] as string,
      userAgent: req.get('user-agent'),
      attributes: req.query.attributes ? JSON.parse(req.query.attributes as string) : {},
    };

    const flags = featureFlags.exportForClient(context);

    res.json({ flags });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Evaluate a specific flag
 */
router.get('/evaluate/:key', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const context = {
      userId: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      plan: (req as any).workspace?.plan,
      workspaceId: req.headers['x-workspace-id'] as string,
      attributes: req.query.attributes ? JSON.parse(req.query.attributes as string) : {},
    };

    const result = featureFlags.evaluate(key, context);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if flag is enabled (simple boolean check)
 */
router.get('/enabled/:key', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const context = {
      userId: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
    };

    const enabled = featureFlags.isEnabled(key, context);

    res.json({ key, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Admin Endpoints ============

/**
 * List all feature flags
 */
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;

    let flags;
    if (tag) {
      flags = featureFlags.getFlagsByTag(tag as string);
    } else {
      flags = featureFlags.getAllFlags();
    }

    res.json({ flags });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific flag
 */
router.get('/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const flag = featureFlags.getFlag(req.params.key);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({ flag });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new feature flag
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, name, description, enabled, type, value, defaultValue, rules, variants, tags } = req.body;

    if (!key || !name || !type) {
      return res.status(400).json({ error: 'key, name, and type are required' });
    }

    // Check if flag already exists
    if (featureFlags.getFlag(key)) {
      return res.status(409).json({ error: 'Flag with this key already exists' });
    }

    const flag = featureFlags.createFlag({
      key,
      name,
      description,
      enabled: enabled ?? true,
      type,
      value: value ?? defaultValue,
      defaultValue: defaultValue ?? (type === 'boolean' ? false : type === 'number' ? 0 : ''),
      rules: rules || [],
      variants,
      tags,
    });

    res.status(201).json({ flag });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a feature flag
 */
router.patch('/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const updates = req.body;

    // Prevent key change
    delete updates.key;
    delete updates.id;
    delete updates.createdAt;

    const flag = featureFlags.updateFlag(key, updates);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({ flag });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle a flag on/off
 */
router.post('/:key/toggle', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const flag = featureFlags.getFlag(key);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const updated = featureFlags.updateFlag(key, { enabled: !flag.enabled });

    res.json({
      message: `Flag ${key} is now ${updated?.enabled ? 'enabled' : 'disabled'}`,
      flag: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a feature flag
 */
router.delete('/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = featureFlags.deleteFlag(req.params.key);

    if (!deleted) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({ message: 'Flag deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Rule Management ============

/**
 * Add a rule to a flag
 */
router.post('/:key/rules', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { priority, conditions, value, percentage, enabled } = req.body;

    const flag = featureFlags.getFlag(key);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const ruleId = `rule_${Date.now()}`;
    const newRule = {
      id: ruleId,
      priority: priority ?? flag.rules.length,
      conditions: conditions || [],
      value,
      percentage,
      enabled: enabled ?? true,
    };

    const updated = featureFlags.updateFlag(key, {
      rules: [...flag.rules, newRule],
    });

    res.status(201).json({ rule: newRule, flag: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a rule
 */
router.patch('/:key/rules/:ruleId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, ruleId } = req.params;
    const updates = req.body;

    const flag = featureFlags.getFlag(key);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const ruleIndex = flag.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updatedRules = [...flag.rules];
    updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], ...updates, id: ruleId };

    const updated = featureFlags.updateFlag(key, { rules: updatedRules });

    res.json({ rule: updatedRules[ruleIndex], flag: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a rule
 */
router.delete('/:key/rules/:ruleId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, ruleId } = req.params;

    const flag = featureFlags.getFlag(key);
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const updatedRules = flag.rules.filter(r => r.id !== ruleId);

    if (updatedRules.length === flag.rules.length) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updated = featureFlags.updateFlag(key, { rules: updatedRules });

    res.json({ message: 'Rule deleted', flag: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ User Overrides ============

/**
 * Set override for a user
 */
router.post('/overrides/:userId/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    featureFlags.setOverride(userId, key, value);

    res.json({ message: 'Override set', userId, key, value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove override for a user
 */
router.delete('/overrides/:userId/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, key } = req.params;

    const removed = featureFlags.removeOverride(userId, key);

    if (!removed) {
      return res.status(404).json({ error: 'Override not found' });
    }

    res.json({ message: 'Override removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all overrides for a user
 */
router.get('/overrides/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const overrides = featureFlags.getUserOverrides(userId);

    res.json({ userId, overrides });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Cache Management ============

/**
 * Clear flag evaluation cache
 */
router.post('/cache/clear', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    featureFlags.clearCache();
    res.json({ message: 'Cache cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const featureFlagsRouter = router;

/**
 * API Key Management Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { apiKeyService, ApiKeyScope } from '../services/ApiKeyService.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * List user's API keys
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const keys = apiKeyService.getUserApiKeys(userId);

    res.json({
      keys: keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        isActive: key.isActive,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        createdAt: key.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new API key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, scopes, permissions, rateLimit, expiresAt, workspaceId, metadata } = req.body;

    // Validate required fields
    if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({
        error: 'name and scopes are required. scopes must be a non-empty array.',
      });
    }

    // Validate scopes
    const validScopes = apiKeyService.constructor.prototype.constructor.getAvailableScopes?.() ||
      ['workflows:read', 'workflows:write', 'workflows:execute', 'executions:read',
       'executions:write', 'credentials:read', 'credentials:write', 'webhooks:read',
       'webhooks:write', 'users:read', 'users:write', 'admin:read', 'admin:write', '*'];

    const validScopeValues = validScopes.map ? validScopes.map((s: any) => s.scope || s) : validScopes;

    for (const scope of scopes) {
      if (!validScopeValues.includes(scope)) {
        return res.status(400).json({
          error: `Invalid scope: ${scope}`,
          validScopes: validScopeValues,
        });
      }
    }

    // Non-admin users cannot create admin scopes
    if (req.user!.role !== 'admin') {
      const adminScopes = ['admin:read', 'admin:write', 'users:write', '*'];
      const hasAdminScope = scopes.some((s: string) => adminScopes.includes(s));
      if (hasAdminScope) {
        return res.status(403).json({
          error: 'Only admins can create API keys with admin or user management scopes',
        });
      }
    }

    // Parse expiration date if provided
    let expirationDate: Date | undefined;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiresAt date format' });
      }
      if (expirationDate <= new Date()) {
        return res.status(400).json({ error: 'expiresAt must be in the future' });
      }
    }

    const result = await apiKeyService.createApiKey({
      name,
      userId,
      workspaceId,
      scopes: scopes as ApiKeyScope[],
      permissions,
      rateLimit,
      expiresAt: expirationDate,
      metadata,
    });

    // Return the plain text key only once - client must store it
    res.status(201).json({
      message: 'API key created successfully. Store this key securely - it will not be shown again.',
      key: result.plainTextKey,
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get API key details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Users can only view their own keys (unless admin)
    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = apiKeyService.getKeyStats(id);

    res.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      },
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update an API key
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, scopes, permissions, rateLimit, isActive, metadata } = req.body;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Users can only update their own keys (unless admin)
    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (scopes !== undefined) updates.scopes = scopes;
    if (permissions !== undefined) updates.permissions = permissions;
    if (rateLimit !== undefined) updates.rateLimit = rateLimit;
    if (isActive !== undefined) updates.isActive = isActive;
    if (metadata !== undefined) updates.metadata = metadata;

    const updated = apiKeyService.updateApiKey(id, updates);

    if (!updated) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      message: 'API key updated successfully',
      apiKey: {
        id: updated.id,
        name: updated.name,
        keyPrefix: updated.keyPrefix,
        scopes: updated.scopes,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete/revoke an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Users can only delete their own keys (unless admin)
    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = apiKeyService.revokeApiKey(id);

    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Rotate an API key (generate new key, invalidate old)
 */
router.post('/:id/rotate', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Users can only rotate their own keys (unless admin)
    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await apiKeyService.rotateApiKey(id);

    if (!result) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      message: 'API key rotated successfully. The old key is now invalid. Store this new key securely.',
      key: result.plainTextKey,
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        createdAt: result.apiKey.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Disable an API key
 */
router.post('/:id/disable', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = apiKeyService.disableApiKey(id);

    res.json({
      message: 'API key disabled',
      apiKey: { id: updated?.id, isActive: updated?.isActive },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Enable an API key
 */
router.post('/:id/enable', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const apiKey = apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (apiKey.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = apiKeyService.enableApiKey(id);

    res.json({
      message: 'API key enabled',
      apiKey: { id: updated?.id, isActive: updated?.isActive },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available scopes
 */
router.get('/meta/scopes', async (_req: Request, res: Response) => {
  try {
    const { default: ApiKeyService } = await import('../services/ApiKeyService.js');
    const scopes = ApiKeyService.getAvailableScopes();
    res.json({ scopes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Admin Routes ============

/**
 * List all API keys (admin only)
 */
router.get('/admin/all', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId } = req.query;

    let keys;
    if (workspaceId) {
      keys = apiKeyService.getWorkspaceApiKeys(workspaceId as string);
    } else if (userId) {
      keys = apiKeyService.getUserApiKeys(userId as string);
    } else {
      // Get all keys - this would need pagination in production
      keys = apiKeyService.getUserApiKeys(''); // Returns empty, need proper implementation
    }

    res.json({
      keys: keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        userId: key.userId,
        workspaceId: key.workspaceId,
        scopes: key.scopes,
        isActive: key.isActive,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        createdAt: key.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cleanup expired keys (admin only)
 */
router.post('/admin/cleanup', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const count = apiKeyService.cleanupExpiredKeys();

    res.json({
      message: `Cleaned up ${count} expired API keys`,
      count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const apiKeyRouter = router;

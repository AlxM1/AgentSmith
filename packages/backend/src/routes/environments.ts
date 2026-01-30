/**
 * Environment Management Routes
 *
 * API endpoints for managing deployment environments
 */

import { Router, Request, Response } from 'express';
import { environmentService } from '../services/EnvironmentService.js';
import { rbacService } from '../services/RBACService.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /environments
 * List all environments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:read');

    const environments = environmentService.getEnvironments();
    res.json(environments);
  } catch (error: any) {
    logger.error('Failed to list environments', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * GET /environments/:id
 * Get environment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:read');

    const environment = environmentService.getEnvironment(req.params.id);
    if (!environment) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    res.json(environment);
  } catch (error: any) {
    logger.error('Failed to get environment', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /environments
 * Create new environment
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:settings');

    const { name, type, description, color, isProtected } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const environment = await environmentService.createEnvironment({
      name,
      type,
      description,
      color,
      isProtected,
    });

    res.status(201).json(environment);
  } catch (error: any) {
    logger.error('Failed to create environment', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * PUT /environments/:id
 * Update environment
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:settings');

    const { name, description, color, isProtected } = req.body;

    const environment = await environmentService.updateEnvironment(req.params.id, {
      name,
      description,
      color,
      isProtected,
    });

    if (!environment) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    res.json(environment);
  } catch (error: any) {
    logger.error('Failed to update environment', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * DELETE /environments/:id
 * Delete environment
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:settings');

    const deleted = await environmentService.deleteEnvironment(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete environment', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 400).json({ error: error.message });
  }
});

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

/**
 * GET /environments/:id/variables
 * Get environment variables
 */
router.get('/:id/variables', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:read');

    const includeSecrets = req.query.includeSecrets === 'true';
    const variables = environmentService.getVariables(req.params.id, includeSecrets);

    res.json(variables);
  } catch (error: any) {
    logger.error('Failed to get environment variables', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /environments/:id/variables
 * Set environment variable
 */
router.post('/:id/variables', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:settings');

    const { key, value, isSecret } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const variable = await environmentService.setVariable(
      req.params.id,
      key,
      value,
      isSecret || false
    );

    res.status(201).json(variable);
  } catch (error: any) {
    logger.error('Failed to set environment variable', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /environments/:id/variables/:key
 * Delete environment variable
 */
router.delete('/:id/variables/:key', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:settings');

    const deleted = await environmentService.deleteVariable(req.params.id, req.params.key);

    if (!deleted) {
      return res.status(404).json({ error: 'Variable not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete environment variable', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WORKFLOW PROMOTION
// ============================================================================

/**
 * POST /environments/promote
 * Promote workflow between environments
 */
router.post('/promote', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:promote');

    const { workflowId, fromEnvironment, toEnvironment, version, comment } = req.body;

    if (!workflowId || !fromEnvironment || !toEnvironment) {
      return res.status(400).json({
        error: 'workflowId, fromEnvironment, and toEnvironment are required',
      });
    }

    const result = await environmentService.promoteWorkflow({
      workflowId,
      fromEnvironment,
      toEnvironment,
      version,
      userId: req.user!.id,
      comment,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.errors?.join(', ') });
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to promote workflow', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /environments/rollback
 * Rollback workflow to previous version
 */
router.post('/rollback', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:rollback');

    const { workflowId, environment, targetVersion, reason } = req.body;

    if (!workflowId || !environment || !targetVersion) {
      return res.status(400).json({
        error: 'workflowId, environment, and targetVersion are required',
      });
    }

    const result = await environmentService.rollbackWorkflow({
      workflowId,
      environment,
      targetVersion,
      userId: req.user!.id,
      reason,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.errors?.join(', ') });
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to rollback workflow', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * GET /environments/promotions/:workflowId
 * Get promotion history for a workflow
 */
router.get('/promotions/:workflowId', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:read');

    const history = environmentService.getPromotionHistory(req.params.workflowId);
    res.json(history);
  } catch (error: any) {
    logger.error('Failed to get promotion history', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /environments/deployments/:workflowId
 * Get workflow deployment status across environments
 */
router.get('/deployments/:workflowId', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'environment:read');

    const status = await environmentService.getDeploymentStatus(req.params.workflowId);
    res.json(Object.fromEntries(status));
  } catch (error: any) {
    logger.error('Failed to get deployment status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export { router as environmentsRouter };

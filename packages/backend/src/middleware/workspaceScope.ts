/**
 * Workspace Scope Middleware
 * Automatically scopes all resource queries to the current workspace
 */

import { Request, Response, NextFunction } from 'express';
import { workspaceService, WorkspacePermission } from '../services/WorkspaceService.js';

export interface WorkspaceScopedRequest extends Request {
  workspaceId?: string;
  workspace?: any;
  workspaceMember?: any;
}

/**
 * Extract and validate workspace context from request
 */
export const workspaceScopeMiddleware = async (
  req: WorkspaceScopedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get workspace ID from various sources
    const workspaceId =
      req.headers['x-workspace-id'] as string ||
      req.query.workspaceId as string ||
      req.params.workspaceId;

    if (!workspaceId) {
      // Allow requests without workspace scope for backward compatibility
      // These will operate on user's default workspace or personal space
      return next();
    }

    const workspace = await workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const member = await workspaceService.getMember(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    // Attach workspace context to request
    req.workspaceId = workspaceId;
    req.workspace = workspace;
    req.workspaceMember = member;

    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Require specific workspace permission
 */
export const requireWorkspacePermission = (permission: WorkspacePermission) => {
  return async (req: WorkspaceScopedRequest, res: Response, next: NextFunction) => {
    if (!req.workspaceId) {
      return next(); // Skip if no workspace scope
    }

    const member = req.workspaceMember;
    if (!member) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (!member.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Permission denied',
        required: permission,
      });
    }

    next();
  };
};

/**
 * Check workspace limits before resource creation
 */
export const checkWorkspaceLimit = (resource: 'workflows' | 'credentials' | 'executions') => {
  return async (req: WorkspaceScopedRequest, res: Response, next: NextFunction) => {
    if (!req.workspaceId) {
      return next();
    }

    const limitMap = {
      workflows: 'maxWorkflows',
      credentials: 'maxCredentials',
      executions: 'maxExecutionsPerMonth',
    } as const;

    const check = await workspaceService.checkLimits(
      req.workspaceId,
      limitMap[resource]
    );

    if (!check.allowed) {
      return res.status(429).json({
        error: `Workspace ${resource} limit reached`,
        current: check.current,
        limit: check.limit,
        upgrade: '/settings/billing',
      });
    }

    next();
  };
};

/**
 * Track workspace usage for executions
 */
export const trackWorkspaceExecution = async (
  req: WorkspaceScopedRequest,
  res: Response,
  next: NextFunction
) => {
  // Track after response is sent
  res.on('finish', async () => {
    if (req.workspaceId && res.statusCode < 400) {
      await workspaceService.incrementUsage(req.workspaceId, 'executionCount');
    }
  });

  next();
};

/**
 * Build workspace-scoped query filter
 */
export const buildWorkspaceFilter = (req: WorkspaceScopedRequest) => {
  if (!req.workspaceId) {
    // Fall back to user-scoped query
    const userId = (req as any).user?.id;
    return { ownerId: userId };
  }

  return { workspaceId: req.workspaceId };
};

/**
 * Middleware to ensure resource belongs to workspace
 */
export const ensureWorkspaceResource = (getResourceWorkspaceId: (req: Request) => Promise<string | null>) => {
  return async (req: WorkspaceScopedRequest, res: Response, next: NextFunction) => {
    if (!req.workspaceId) {
      return next();
    }

    const resourceWorkspaceId = await getResourceWorkspaceId(req);

    if (resourceWorkspaceId && resourceWorkspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    next();
  };
};

/**
 * Auto-assign workspace to new resources
 */
export const assignWorkspace = (req: WorkspaceScopedRequest, res: Response, next: NextFunction) => {
  if (req.workspaceId && req.body) {
    req.body.workspaceId = req.workspaceId;
  }
  next();
};

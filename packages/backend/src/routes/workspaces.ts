/**
 * Workspace Routes - Multi-tenancy API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { workspaceService, WorkspacePermission } from '../services/WorkspaceService.js';

const router = Router();

// Middleware to extract workspace from request
const extractWorkspace = async (req: Request, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.headers['x-workspace-id'] as string;

  if (!workspaceId) {
    return res.status(400).json({ error: 'Workspace ID required' });
  }

  const workspace = await workspaceService.getWorkspace(workspaceId);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  (req as any).workspace = workspace;
  next();
};

// Middleware to check workspace permission
const requirePermission = (permission: WorkspacePermission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const workspace = (req as any).workspace;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = await workspaceService.hasPermission(workspace.id, userId, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    next();
  };
};

/**
 * Create a new workspace
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, plan } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name required' });
    }

    const workspace = await workspaceService.createWorkspace(name, userId, {
      description,
      plan,
    });

    res.status(201).json(workspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user's workspaces
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspaces = await workspaceService.getUserWorkspaces(userId);
    res.json(workspaces);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get workspace by ID
 */
router.get('/:workspaceId', extractWorkspace, async (req: Request, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    const userId = (req as any).user?.id;

    // Check if user is a member
    const member = await workspaceService.getMember(workspace.id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    res.json(workspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get workspace by slug
 */
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const workspace = await workspaceService.getWorkspaceBySlug(req.params.slug);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const userId = (req as any).user?.id;
    const member = await workspaceService.getMember(workspace.id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    res.json(workspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update workspace
 */
router.patch(
  '/:workspaceId',
  extractWorkspace,
  requirePermission('workspace:manage'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const { name, description, settings } = req.body;

      const updated = await workspaceService.updateWorkspace(workspace.id, {
        name,
        description,
        settings,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Delete workspace
 */
router.delete(
  '/:workspaceId',
  extractWorkspace,
  requirePermission('workspace:manage'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const userId = (req as any).user?.id;

      // Only owner can delete
      if (workspace.ownerId !== userId) {
        return res.status(403).json({ error: 'Only the owner can delete the workspace' });
      }

      await workspaceService.deleteWorkspace(workspace.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Get workspace members
 */
router.get(
  '/:workspaceId/members',
  extractWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const userId = (req as any).user?.id;

      const member = await workspaceService.getMember(workspace.id, userId);
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this workspace' });
      }

      const members = await workspaceService.getMembers(workspace.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Invite user to workspace
 */
router.post(
  '/:workspaceId/invites',
  extractWorkspace,
  requirePermission('workspace:members'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const userId = (req as any).user?.id;
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: 'Email and role required' });
      }

      const invite = await workspaceService.createInvite(
        workspace.id,
        email,
        role,
        userId
      );

      // TODO: Send invitation email
      res.status(201).json({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteLink: `/invite/${invite.token}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Accept workspace invite
 */
router.post('/invites/:token/accept', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const member = await workspaceService.acceptInvite(req.params.token, userId);
    const workspace = await workspaceService.getWorkspace(member.workspaceId);

    res.json({
      workspace,
      member,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update member role
 */
router.patch(
  '/:workspaceId/members/:userId',
  extractWorkspace,
  requirePermission('workspace:members'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role required' });
      }

      const member = await workspaceService.updateMemberRole(workspace.id, userId, role);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Remove member from workspace
 */
router.delete(
  '/:workspaceId/members/:userId',
  extractWorkspace,
  requirePermission('workspace:members'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const { userId } = req.params;

      const removed = await workspaceService.removeMember(workspace.id, userId);
      if (!removed) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Leave workspace
 */
router.post(
  '/:workspaceId/leave',
  extractWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const userId = (req as any).user?.id;

      const removed = await workspaceService.removeMember(workspace.id, userId);
      if (!removed) {
        return res.status(400).json({ error: 'Cannot leave workspace' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Transfer workspace ownership
 */
router.post(
  '/:workspaceId/transfer-ownership',
  extractWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const userId = (req as any).user?.id;
      const { newOwnerId } = req.body;

      if (!newOwnerId) {
        return res.status(400).json({ error: 'New owner ID required' });
      }

      await workspaceService.transferOwnership(workspace.id, userId, newOwnerId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Get workspace usage
 */
router.get(
  '/:workspaceId/usage',
  extractWorkspace,
  requirePermission('workspace:manage'),
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;
      const period = req.query.period as string;

      const usage = await workspaceService.getUsage(workspace.id, period);
      const limits = workspace.limits;

      res.json({
        usage: usage || {
          executionCount: 0,
          activeWorkflows: 0,
          storageUsedBytes: 0,
          apiCalls: 0,
        },
        limits,
        plan: workspace.plan,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Check workspace limits
 */
router.get(
  '/:workspaceId/limits',
  extractWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspace = (req as any).workspace;

      const checks = await Promise.all([
        workspaceService.checkLimits(workspace.id, 'maxUsers'),
        workspaceService.checkLimits(workspace.id, 'maxWorkflows'),
        workspaceService.checkLimits(workspace.id, 'maxExecutionsPerMonth'),
        workspaceService.checkLimits(workspace.id, 'maxCredentials'),
      ]);

      res.json({
        users: checks[0],
        workflows: checks[1],
        executions: checks[2],
        credentials: checks[3],
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export const workspacesRouter = router;

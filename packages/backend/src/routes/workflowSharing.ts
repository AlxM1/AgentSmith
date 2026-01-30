// Workflow Sharing Routes
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { workflows, users } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { logger, logAudit } from '../lib/logger.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const shareWorkflowSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(['view', 'edit', 'admin']).default('view'),
});

const updateShareSchema = z.object({
  permission: z.enum(['view', 'edit', 'admin']),
});

// Types
interface WorkflowShare {
  id: string;
  workflowId: string;
  userId: string;
  permission: string;
  createdAt: Date;
  createdBy: string;
}

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Get all shares for a workflow
 * GET /api/v1/workflows/:id/shares
 */
router.get('/:id/shares', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Check if user owns the workflow or is admin
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    // Only owner or admin can view shares
    if (workflow.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get shares with user info
    // Note: This uses a raw query since workflow_shares table needs to be added
    const shares = await db.execute(sql`
      SELECT
        ws.id,
        ws.workflow_id as "workflowId",
        ws.user_id as "userId",
        ws.permission,
        ws.created_at as "createdAt",
        u.email as "userEmail",
        u.first_name || ' ' || u.last_name as "userName"
      FROM workflow_shares ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.workflow_id = ${id}
      ORDER BY ws.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        shares: shares.rows || [],
        owner: {
          id: workflow.createdBy,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Share a workflow with a user
 * POST /api/v1/workflows/:id/shares
 */
router.post('/:id/shares', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Validate request body
    const data = shareWorkflowSchema.parse(req.body);

    // Check if user owns the workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    if (workflow.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can share this workflow',
      });
    }

    // Check if target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Can't share with yourself
    if (data.userId === workflow.createdBy) {
      return res.status(400).json({
        success: false,
        message: 'Cannot share with yourself',
      });
    }

    // Check if share already exists
    const existingShare = await db.execute(sql`
      SELECT id FROM workflow_shares
      WHERE workflow_id = ${id} AND user_id = ${data.userId}
    `);

    if (existingShare.rows && existingShare.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Workflow already shared with this user',
      });
    }

    // Create share
    const shareId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.execute(sql`
      INSERT INTO workflow_shares (id, workflow_id, user_id, permission, created_at, created_by)
      VALUES (${shareId}, ${id}, ${data.userId}, ${data.permission}, NOW(), ${userId})
    `);

    // Log audit
    logAudit('workflow.share', userId || null, {
      workflowId: id,
      sharedWith: data.userId,
      permission: data.permission,
    });

    res.status(201).json({
      success: true,
      data: {
        id: shareId,
        workflowId: id,
        userId: data.userId,
        permission: data.permission,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Update share permission
 * PUT /api/v1/workflows/:id/shares/:shareId
 */
router.put('/:id/shares/:shareId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, shareId } = req.params;
    const userId = req.user?.userId;

    // Validate request body
    const data = updateShareSchema.parse(req.body);

    // Check if user owns the workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    if (workflow.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can modify shares',
      });
    }

    // Update share
    await db.execute(sql`
      UPDATE workflow_shares
      SET permission = ${data.permission}
      WHERE id = ${shareId} AND workflow_id = ${id}
    `);

    res.json({
      success: true,
      message: 'Share updated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Remove share
 * DELETE /api/v1/workflows/:id/shares/:shareId
 */
router.delete('/:id/shares/:shareId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, shareId } = req.params;
    const userId = req.user?.userId;

    // Check if user owns the workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    if (workflow.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can remove shares',
      });
    }

    // Delete share
    await db.execute(sql`
      DELETE FROM workflow_shares
      WHERE id = ${shareId} AND workflow_id = ${id}
    `);

    // Log audit
    logAudit('workflow.unshare', userId || null, {
      workflowId: id,
      shareId,
    });

    res.json({
      success: true,
      message: 'Share removed',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get workflows shared with current user
 * GET /api/v1/workflows/shared-with-me
 */
router.get('/shared-with-me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const sharedWorkflows = await db.execute(sql`
      SELECT
        w.*,
        ws.permission,
        u.email as "ownerEmail",
        u.first_name || ' ' || u.last_name as "ownerName"
      FROM workflow_shares ws
      JOIN workflows w ON ws.workflow_id = w.id
      JOIN users u ON w.created_by = u.id
      WHERE ws.user_id = ${userId}
      ORDER BY w.updated_at DESC
    `);

    res.json({
      success: true,
      data: {
        workflows: sharedWorkflows.rows || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as workflowSharingRouter };

// @ts-nocheck
/**
 * Workflow Versioning Service
 *
 * Manages workflow version history for rollback and audit purposes
 */

import { db } from '../db/index.js';
import { workflows, workflowVersions, users } from '../db/schema.js';
import { eq, desc, and, asc } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  versionNumber: number;
  name: string;
  description?: string;
  nodes: unknown[];
  connections: unknown[];
  settings: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  createdBy: string;
  createdByEmail?: string;
  comment?: string;
}

export interface VersionDiff {
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesModified: string[];
  connectionsChanged: boolean;
  settingsChanged: boolean;
}

// ============================================================================
// VERSIONING SERVICE
// ============================================================================

class WorkflowVersioningService {
  /**
   * Create a new version of a workflow
   */
  async createVersion(params: {
    workflowId: string;
    userId: string;
    comment?: string;
  }): Promise<WorkflowVersion> {
    const { workflowId, userId, comment } = params;

    // Get the current workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Get the latest version number
    const latestVersion = await db.query.workflowVersions.findFirst({
      where: eq(workflowVersions.workflowId, workflowId),
      orderBy: [desc(workflowVersions.versionNumber)],
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    const versionId = `wv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Create the version
    const [version] = await db.insert(workflowVersions).values({
      id: versionId,
      workflowId,
      versionNumber: newVersionNumber,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings as Record<string, unknown>,
      active: workflow.active,
      createdBy: userId,
      comment,
    }).returning();

    // Update workflow's version ID
    await db.update(workflows)
      .set({ versionId: newVersionNumber, updatedAt: new Date() })
      .where(eq(workflows.id, workflowId));

    logger.info('Created workflow version', {
      workflowId,
      versionId,
      versionNumber: newVersionNumber,
    });

    return {
      ...version,
      nodes: version.nodes as unknown[],
      connections: version.connections as unknown[],
      settings: version.settings as Record<string, unknown>,
      description: version.description || undefined,
      comment: version.comment || undefined,
    };
  }

  /**
   * Get version history for a workflow
   */
  async getVersionHistory(
    workflowId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ versions: WorkflowVersion[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    // Get versions with user info
    const versions = await db
      .select({
        version: workflowVersions,
        userEmail: users.email,
      })
      .from(workflowVersions)
      .leftJoin(users, eq(workflowVersions.createdBy, users.id))
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.versionNumber))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allVersions = await db.query.workflowVersions.findMany({
      where: eq(workflowVersions.workflowId, workflowId),
    });

    return {
      versions: versions.map(({ version, userEmail }) => ({
        ...version,
        nodes: version.nodes as unknown[],
        connections: version.connections as unknown[],
        settings: version.settings as Record<string, unknown>,
        description: version.description || undefined,
        comment: version.comment || undefined,
        createdByEmail: userEmail || undefined,
      })),
      total: allVersions.length,
    };
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<WorkflowVersion | null> {
    const version = await db.query.workflowVersions.findFirst({
      where: eq(workflowVersions.id, versionId),
    });

    if (!version) return null;

    return {
      ...version,
      nodes: version.nodes as unknown[],
      connections: version.connections as unknown[],
      settings: version.settings as Record<string, unknown>,
      description: version.description || undefined,
      comment: version.comment || undefined,
    };
  }

  /**
   * Get version by number
   */
  async getVersionByNumber(workflowId: string, versionNumber: number): Promise<WorkflowVersion | null> {
    const version = await db.query.workflowVersions.findFirst({
      where: and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.versionNumber, versionNumber)
      ),
    });

    if (!version) return null;

    return {
      ...version,
      nodes: version.nodes as unknown[],
      connections: version.connections as unknown[],
      settings: version.settings as Record<string, unknown>,
      description: version.description || undefined,
      comment: version.comment || undefined,
    };
  }

  /**
   * Rollback workflow to a specific version
   */
  async rollbackToVersion(params: {
    workflowId: string;
    versionId: string;
    userId: string;
  }): Promise<void> {
    const { workflowId, versionId, userId } = params;

    // Get the version to rollback to
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    if (version.workflowId !== workflowId) {
      throw new Error('Version does not belong to this workflow');
    }

    // Create a new version of the current state before rollback
    await this.createVersion({
      workflowId,
      userId,
      comment: `Auto-saved before rollback to version ${version.versionNumber}`,
    });

    // Update workflow with version data
    await db.update(workflows)
      .set({
        name: version.name,
        description: version.description,
        nodes: version.nodes,
        connections: version.connections,
        settings: version.settings,
        active: version.active,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));

    // Create a new version for the rollback
    await this.createVersion({
      workflowId,
      userId,
      comment: `Rolled back to version ${version.versionNumber}`,
    });

    logger.info('Rolled back workflow to version', {
      workflowId,
      versionId,
      versionNumber: version.versionNumber,
    });
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff> {
    const [version1, version2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2),
    ]);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const nodes1 = version1.nodes as Array<{ id: string; type: string; parameters: unknown }>;
    const nodes2 = version2.nodes as Array<{ id: string; type: string; parameters: unknown }>;

    const nodeIds1 = new Set(nodes1.map(n => n.id));
    const nodeIds2 = new Set(nodes2.map(n => n.id));

    const nodesAdded = nodes2.filter(n => !nodeIds1.has(n.id)).map(n => n.id);
    const nodesRemoved = nodes1.filter(n => !nodeIds2.has(n.id)).map(n => n.id);

    const nodesModified: string[] = [];
    for (const node2 of nodes2) {
      if (nodeIds1.has(node2.id)) {
        const node1 = nodes1.find(n => n.id === node2.id);
        if (node1 && JSON.stringify(node1) !== JSON.stringify(node2)) {
          nodesModified.push(node2.id);
        }
      }
    }

    return {
      nodesAdded,
      nodesRemoved,
      nodesModified,
      connectionsChanged: JSON.stringify(version1.connections) !== JSON.stringify(version2.connections),
      settingsChanged: JSON.stringify(version1.settings) !== JSON.stringify(version2.settings),
    };
  }

  /**
   * Delete old versions (keep latest N versions)
   */
  async pruneVersions(workflowId: string, keepCount: number = 50): Promise<number> {
    // Get all versions ordered by version number
    const allVersions = await db.query.workflowVersions.findMany({
      where: eq(workflowVersions.workflowId, workflowId),
      orderBy: [desc(workflowVersions.versionNumber)],
    });

    if (allVersions.length <= keepCount) {
      return 0;
    }

    // Get IDs to delete (all except the latest keepCount)
    const versionsToDelete = allVersions.slice(keepCount);
    const idsToDelete = versionsToDelete.map(v => v.id);

    // Delete old versions
    for (const id of idsToDelete) {
      await db.delete(workflowVersions).where(eq(workflowVersions.id, id));
    }

    logger.info('Pruned workflow versions', {
      workflowId,
      deleted: idsToDelete.length,
      remaining: keepCount,
    });

    return idsToDelete.length;
  }

  /**
   * Auto-save version on significant changes
   * Called automatically when workflow is updated
   */
  async autoSaveIfNeeded(params: {
    workflowId: string;
    userId: string;
    oldWorkflow: {
      nodes: unknown[];
      connections: unknown[];
    };
    newWorkflow: {
      nodes: unknown[];
      connections: unknown[];
    };
  }): Promise<boolean> {
    const { workflowId, userId, oldWorkflow, newWorkflow } = params;

    // Check if there are significant changes
    const oldNodes = oldWorkflow.nodes as Array<{ id: string }>;
    const newNodes = newWorkflow.nodes as Array<{ id: string }>;

    const oldNodeIds = new Set(oldNodes.map(n => n.id));
    const newNodeIds = new Set(newNodes.map(n => n.id));

    // Count changes
    const nodesAdded = newNodes.filter(n => !oldNodeIds.has(n.id)).length;
    const nodesRemoved = oldNodes.filter(n => !newNodeIds.has(n.id)).length;
    const connectionsChanged = JSON.stringify(oldWorkflow.connections) !== JSON.stringify(newWorkflow.connections);

    // Auto-save if significant changes
    const significantChange = nodesAdded > 0 || nodesRemoved > 0 || connectionsChanged;

    if (significantChange) {
      await this.createVersion({
        workflowId,
        userId,
        comment: 'Auto-saved',
      });
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const versioningService = new WorkflowVersioningService();

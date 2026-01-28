/**
 * Workflow Version Manager
 * Handles version control operations for workflows
 */

import { createHash } from 'crypto';
import type {
  WorkflowVersion,
  WorkflowVersionCreateInput,
  WorkflowVersionDiff,
  WorkflowVersionHistory,
  WorkflowVersionCompareResult,
  WorkflowVersionRestoreOptions,
} from './types';

export class WorkflowVersionManager {
  private versions: Map<string, WorkflowVersion[]> = new Map();

  /**
   * Calculate hash for workflow content
   */
  calculateHash(nodes: any[], connections: any[], settings: Record<string, any>): string {
    const content = JSON.stringify({ nodes, connections, settings }, null, 0);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Create a new version of a workflow
   */
  async createVersion(input: WorkflowVersionCreateInput): Promise<WorkflowVersion> {
    const workflowVersions = this.versions.get(input.workflowId) || [];
    const lastVersion = workflowVersions[workflowVersions.length - 1];

    const hash = this.calculateHash(
      input.nodes,
      input.connections,
      input.settings || {}
    );

    // Check if content has changed
    if (lastVersion && lastVersion.hash === hash) {
      throw new Error('No changes detected since last version');
    }

    const newVersion: WorkflowVersion = {
      id: `wv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: input.workflowId,
      versionNumber: (lastVersion?.versionNumber || 0) + 1,
      name: input.name || `Version ${(lastVersion?.versionNumber || 0) + 1}`,
      description: input.description,
      createdAt: new Date(),
      createdBy: input.createdBy,
      nodes: structuredClone(input.nodes),
      connections: structuredClone(input.connections),
      settings: structuredClone(input.settings || {}),
      variables: structuredClone(input.variables || {}),
      hash,
      parentVersionId: lastVersion?.id,
      isActive: true,
      isPublished: false,
      tags: input.tags || [],
    };

    // Deactivate previous version
    if (lastVersion) {
      lastVersion.isActive = false;
    }

    workflowVersions.push(newVersion);
    this.versions.set(input.workflowId, workflowVersions);

    return newVersion;
  }

  /**
   * Get version history for a workflow
   */
  async getHistory(workflowId: string): Promise<WorkflowVersionHistory> {
    const versions = this.versions.get(workflowId) || [];
    const currentVersion = versions.find(v => v.isActive);

    return {
      workflowId,
      currentVersion: currentVersion?.versionNumber || 0,
      versions: versions.slice().reverse(), // Most recent first
      totalVersions: versions.length,
    };
  }

  /**
   * Get a specific version
   */
  async getVersion(workflowId: string, versionNumber: number): Promise<WorkflowVersion | null> {
    const versions = this.versions.get(workflowId) || [];
    return versions.find(v => v.versionNumber === versionNumber) || null;
  }

  /**
   * Get version by ID
   */
  async getVersionById(versionId: string): Promise<WorkflowVersion | null> {
    for (const versions of this.versions.values()) {
      const version = versions.find(v => v.id === versionId);
      if (version) return version;
    }
    return null;
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    workflowId: string,
    versionA: number,
    versionB: number
  ): Promise<WorkflowVersionCompareResult> {
    const versions = this.versions.get(workflowId) || [];
    const verA = versions.find(v => v.versionNumber === versionA);
    const verB = versions.find(v => v.versionNumber === versionB);

    if (!verA || !verB) {
      throw new Error('One or both versions not found');
    }

    if (verA.hash === verB.hash) {
      return { identical: true, diff: null, similarity: 100 };
    }

    const diff = this.computeDiff(verA, verB);
    const similarity = this.calculateSimilarity(verA, verB);

    return { identical: false, diff, similarity };
  }

  /**
   * Compute differences between two versions
   */
  private computeDiff(versionA: WorkflowVersion, versionB: WorkflowVersion): WorkflowVersionDiff {
    const nodesA = new Map(versionA.nodes.map(n => [n.id, n]));
    const nodesB = new Map(versionB.nodes.map(n => [n.id, n]));

    // Find node differences
    const addedNodes: any[] = [];
    const removedNodes: any[] = [];
    const modifiedNodes: Array<{ nodeId: string; before: any; after: any; changes: string[] }> = [];

    // Check for added and modified nodes
    for (const [id, nodeB] of nodesB) {
      const nodeA = nodesA.get(id);
      if (!nodeA) {
        addedNodes.push(nodeB);
      } else if (JSON.stringify(nodeA) !== JSON.stringify(nodeB)) {
        const changes = this.findNodeChanges(nodeA, nodeB);
        modifiedNodes.push({ nodeId: id, before: nodeA, after: nodeB, changes });
      }
    }

    // Check for removed nodes
    for (const [id, nodeA] of nodesA) {
      if (!nodesB.has(id)) {
        removedNodes.push(nodeA);
      }
    }

    // Connection differences
    const connectionsAStr = JSON.stringify(versionA.connections);
    const connectionsBStr = JSON.stringify(versionB.connections);
    const addedConnections = versionB.connections.filter(
      c => !versionA.connections.some(ac => JSON.stringify(ac) === JSON.stringify(c))
    );
    const removedConnections = versionA.connections.filter(
      c => !versionB.connections.some(bc => JSON.stringify(bc) === JSON.stringify(c))
    );

    // Settings differences
    const changedSettingsKeys = this.findChangedKeys(versionA.settings, versionB.settings);

    // Generate summary
    const summaryParts: string[] = [];
    if (addedNodes.length) summaryParts.push(`${addedNodes.length} node(s) added`);
    if (removedNodes.length) summaryParts.push(`${removedNodes.length} node(s) removed`);
    if (modifiedNodes.length) summaryParts.push(`${modifiedNodes.length} node(s) modified`);
    if (addedConnections.length) summaryParts.push(`${addedConnections.length} connection(s) added`);
    if (removedConnections.length) summaryParts.push(`${removedConnections.length} connection(s) removed`);
    if (changedSettingsKeys.length) summaryParts.push(`${changedSettingsKeys.length} setting(s) changed`);

    return {
      versionA: versionA.id,
      versionB: versionB.id,
      changes: {
        nodes: {
          added: addedNodes,
          removed: removedNodes,
          modified: modifiedNodes,
        },
        connections: {
          added: addedConnections,
          removed: removedConnections,
        },
        settings: {
          before: versionA.settings,
          after: versionB.settings,
          changedKeys: changedSettingsKeys,
        },
      },
      summary: summaryParts.join(', ') || 'No changes',
    };
  }

  /**
   * Find changes between two node objects
   */
  private findNodeChanges(nodeA: any, nodeB: any): string[] {
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(nodeA), ...Object.keys(nodeB)]);

    for (const key of allKeys) {
      if (JSON.stringify(nodeA[key]) !== JSON.stringify(nodeB[key])) {
        changes.push(key);
      }
    }

    return changes;
  }

  /**
   * Find changed keys between two objects
   */
  private findChangedKeys(objA: Record<string, any>, objB: Record<string, any>): string[] {
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
      if (JSON.stringify(objA[key]) !== JSON.stringify(objB[key])) {
        changes.push(key);
      }
    }

    return changes;
  }

  /**
   * Calculate similarity percentage between two versions
   */
  private calculateSimilarity(versionA: WorkflowVersion, versionB: WorkflowVersion): number {
    const nodesA = new Set(versionA.nodes.map(n => n.id));
    const nodesB = new Set(versionB.nodes.map(n => n.id));

    const intersection = new Set([...nodesA].filter(x => nodesB.has(x)));
    const union = new Set([...nodesA, ...nodesB]);

    if (union.size === 0) return 100;
    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(options: WorkflowVersionRestoreOptions): Promise<WorkflowVersion> {
    const version = await this.getVersionById(options.versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    if (options.createNewVersion !== false) {
      // Create a new version with the restored content
      return this.createVersion({
        workflowId: version.workflowId,
        name: `Restored from v${version.versionNumber}`,
        description: `Restored from version ${version.versionNumber} (${version.name})`,
        createdBy: 'system',
        nodes: version.nodes,
        connections: version.connections,
        settings: version.settings,
        variables: version.variables,
        tags: ['restored'],
      });
    }

    // Just mark this version as active
    const versions = this.versions.get(version.workflowId) || [];
    for (const v of versions) {
      v.isActive = v.id === version.id;
    }

    return version;
  }

  /**
   * Publish a version
   */
  async publishVersion(versionId: string): Promise<WorkflowVersion> {
    const version = await this.getVersionById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Unpublish other versions
    const versions = this.versions.get(version.workflowId) || [];
    for (const v of versions) {
      v.isPublished = v.id === version.id;
    }

    return version;
  }

  /**
   * Add tags to a version
   */
  async addTags(versionId: string, tags: string[]): Promise<WorkflowVersion> {
    const version = await this.getVersionById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    version.tags = [...new Set([...version.tags, ...tags])];
    return version;
  }

  /**
   * Delete old versions (keep N most recent)
   */
  async pruneVersions(workflowId: string, keepCount: number): Promise<number> {
    const versions = this.versions.get(workflowId) || [];
    if (versions.length <= keepCount) return 0;

    const toDelete = versions.slice(0, versions.length - keepCount);
    const toKeep = versions.slice(versions.length - keepCount);

    this.versions.set(workflowId, toKeep);
    return toDelete.length;
  }
}

// Singleton instance
export const versionManager = new WorkflowVersionManager();

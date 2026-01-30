// @ts-nocheck
/**
 * Workflow Folder Service
 *
 * Organize workflows into hierarchical folders:
 * - Create/update/delete folders
 * - Move workflows between folders
 * - Folder-level permissions
 * - Nested folder support
 */

import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { workflows } from '../db/schema.js';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId: string | null;
  ownerId: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  workflowCount: number;
  subfolderCount: number;
  createdAt: Date;
  updatedAt: Date;
  path: string; // Full path like "/Projects/Marketing/Campaigns"
}

export interface FolderTree extends Folder {
  children: FolderTree[];
  workflows: FolderWorkflow[];
}

export interface FolderWorkflow {
  id: string;
  name: string;
  active: boolean;
  status: string;
  updatedAt: Date;
}

export interface MoveResult {
  success: boolean;
  movedItems: string[];
  errors?: string[];
}

// ============================================================================
// IN-MEMORY STORAGE (Replace with DB table in production)
// ============================================================================

const folderStore: Map<string, Folder> = new Map();
const workflowFolders: Map<string, string> = new Map(); // workflowId -> folderId

// ============================================================================
// WORKFLOW FOLDER SERVICE
// ============================================================================

class WorkflowFolderService {
  private isInitialized = false;

  /**
   * Initialize folder service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create root folders for each user as needed
    this.isInitialized = true;
    logger.info('Workflow folder service initialized');
  }

  // ============================================================================
  // FOLDER CRUD
  // ============================================================================

  /**
   * Create a new folder
   */
  async createFolder(data: {
    name: string;
    description?: string;
    parentId?: string;
    ownerId: string;
    color?: string;
    icon?: string;
  }): Promise<Folder> {
    // Validate parent exists if specified
    if (data.parentId) {
      const parent = folderStore.get(data.parentId);
      if (!parent) {
        throw new Error('Parent folder not found');
      }
      if (parent.ownerId !== data.ownerId) {
        throw new Error('Cannot create folder in another user\'s folder');
      }
    }

    const id = `folder_${crypto.randomUUID().substring(0, 8)}`;

    // Calculate path
    let path = `/${data.name}`;
    if (data.parentId) {
      const parent = folderStore.get(data.parentId);
      if (parent) {
        path = `${parent.path}/${data.name}`;
      }
    }

    // Get sort order (last in parent)
    const siblings = this.getChildFolders(data.parentId || null, data.ownerId);
    const sortOrder = siblings.length > 0
      ? Math.max(...siblings.map(s => s.sortOrder)) + 1
      : 0;

    const folder: Folder = {
      id,
      name: data.name,
      description: data.description,
      parentId: data.parentId || null,
      ownerId: data.ownerId,
      color: data.color,
      icon: data.icon,
      sortOrder,
      workflowCount: 0,
      subfolderCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      path,
    };

    folderStore.set(id, folder);

    // Update parent's subfolder count
    if (data.parentId) {
      const parent = folderStore.get(data.parentId);
      if (parent) {
        parent.subfolderCount++;
        parent.updatedAt = new Date();
      }
    }

    logger.info('Created folder', { id, name: data.name, path });

    return folder;
  }

  /**
   * Get folder by ID
   */
  getFolder(id: string): Folder | undefined {
    return folderStore.get(id);
  }

  /**
   * Get folders for a user
   */
  getUserFolders(userId: string): Folder[] {
    return Array.from(folderStore.values())
      .filter(f => f.ownerId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get child folders
   */
  getChildFolders(parentId: string | null, ownerId: string): Folder[] {
    return Array.from(folderStore.values())
      .filter(f => f.parentId === parentId && f.ownerId === ownerId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get folder tree
   */
  async getFolderTree(userId: string): Promise<FolderTree[]> {
    const userFolders = this.getUserFolders(userId);
    const rootFolders = userFolders.filter(f => !f.parentId);

    const buildTree = async (folder: Folder): Promise<FolderTree> => {
      const children = userFolders.filter(f => f.parentId === folder.id);
      const workflows = await this.getFolderWorkflows(folder.id);

      return {
        ...folder,
        children: await Promise.all(children.map(c => buildTree(c))),
        workflows,
      };
    };

    return Promise.all(rootFolders.map(f => buildTree(f)));
  }

  /**
   * Update folder
   */
  async updateFolder(
    id: string,
    updates: Partial<Pick<Folder, 'name' | 'description' | 'color' | 'icon'>>
  ): Promise<Folder | null> {
    const folder = folderStore.get(id);
    if (!folder) return null;

    const updated: Folder = {
      ...folder,
      ...updates,
      updatedAt: new Date(),
    };

    // Update path if name changed
    if (updates.name && updates.name !== folder.name) {
      updated.path = folder.path.replace(new RegExp(`/${folder.name}$`), `/${updates.name}`);
      // Update child paths recursively
      await this.updateChildPaths(id, folder.path, updated.path);
    }

    folderStore.set(id, updated);

    logger.info('Updated folder', { id });

    return updated;
  }

  /**
   * Delete folder
   */
  async deleteFolder(id: string, moveWorkflowsTo?: string): Promise<boolean> {
    const folder = folderStore.get(id);
    if (!folder) return false;

    // Get all workflows in this folder
    const workflowIds = Array.from(workflowFolders.entries())
      .filter(([_, folderId]) => folderId === id)
      .map(([workflowId]) => workflowId);

    // Move or delete workflows
    if (moveWorkflowsTo) {
      for (const workflowId of workflowIds) {
        await this.moveWorkflowToFolder(workflowId, moveWorkflowsTo);
      }
    } else {
      for (const workflowId of workflowIds) {
        workflowFolders.delete(workflowId);
      }
    }

    // Delete child folders recursively
    const children = this.getChildFolders(id, folder.ownerId);
    for (const child of children) {
      await this.deleteFolder(child.id, moveWorkflowsTo);
    }

    // Update parent's subfolder count
    if (folder.parentId) {
      const parent = folderStore.get(folder.parentId);
      if (parent) {
        parent.subfolderCount = Math.max(0, parent.subfolderCount - 1);
        parent.updatedAt = new Date();
      }
    }

    folderStore.delete(id);

    logger.info('Deleted folder', { id });

    return true;
  }

  /**
   * Move folder to new parent
   */
  async moveFolder(id: string, newParentId: string | null): Promise<Folder | null> {
    const folder = folderStore.get(id);
    if (!folder) return null;

    // Validate new parent
    if (newParentId) {
      const newParent = folderStore.get(newParentId);
      if (!newParent) {
        throw new Error('Target folder not found');
      }
      if (newParent.ownerId !== folder.ownerId) {
        throw new Error('Cannot move folder to another user\'s folder');
      }
      // Prevent moving to self or descendant
      if (newParentId === id || this.isDescendant(newParentId, id)) {
        throw new Error('Cannot move folder to itself or its descendant');
      }
    }

    // Update old parent's subfolder count
    if (folder.parentId) {
      const oldParent = folderStore.get(folder.parentId);
      if (oldParent) {
        oldParent.subfolderCount = Math.max(0, oldParent.subfolderCount - 1);
        oldParent.updatedAt = new Date();
      }
    }

    // Update folder
    const oldPath = folder.path;
    folder.parentId = newParentId;

    // Calculate new path
    if (newParentId) {
      const newParent = folderStore.get(newParentId);
      folder.path = `${newParent!.path}/${folder.name}`;
    } else {
      folder.path = `/${folder.name}`;
    }

    folder.updatedAt = new Date();

    // Update new parent's subfolder count
    if (newParentId) {
      const newParent = folderStore.get(newParentId);
      if (newParent) {
        newParent.subfolderCount++;
        newParent.updatedAt = new Date();
      }
    }

    // Update child paths
    await this.updateChildPaths(id, oldPath, folder.path);

    logger.info('Moved folder', { id, newParentId });

    return folder;
  }

  // ============================================================================
  // WORKFLOW OPERATIONS
  // ============================================================================

  /**
   * Get workflows in a folder
   */
  async getFolderWorkflows(folderId: string): Promise<FolderWorkflow[]> {
    const workflowIds = Array.from(workflowFolders.entries())
      .filter(([_, id]) => id === folderId)
      .map(([workflowId]) => workflowId);

    if (workflowIds.length === 0) return [];

    const result = await db.query.workflows.findMany({
      where: inArray(workflows.id, workflowIds),
    });

    return result.map(w => ({
      id: w.id,
      name: w.name,
      active: w.active,
      status: w.status,
      updatedAt: w.updatedAt,
    }));
  }

  /**
   * Get unfiled workflows (not in any folder)
   */
  async getUnfiledWorkflows(userId: string): Promise<FolderWorkflow[]> {
    const allUserWorkflows = await db.query.workflows.findMany({
      where: eq(workflows.createdBy, userId),
    });

    const filedWorkflowIds = new Set(workflowFolders.keys());

    return allUserWorkflows
      .filter(w => !filedWorkflowIds.has(w.id))
      .map(w => ({
        id: w.id,
        name: w.name,
        active: w.active,
        status: w.status,
        updatedAt: w.updatedAt,
      }));
  }

  /**
   * Move workflow to folder
   */
  async moveWorkflowToFolder(workflowId: string, folderId: string | null): Promise<boolean> {
    // Validate workflow exists
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Get current folder
    const currentFolderId = workflowFolders.get(workflowId);

    // Update old folder count
    if (currentFolderId) {
      const oldFolder = folderStore.get(currentFolderId);
      if (oldFolder) {
        oldFolder.workflowCount = Math.max(0, oldFolder.workflowCount - 1);
        oldFolder.updatedAt = new Date();
      }
    }

    if (folderId) {
      // Validate target folder
      const targetFolder = folderStore.get(folderId);
      if (!targetFolder) {
        throw new Error('Target folder not found');
      }

      // Update mapping
      workflowFolders.set(workflowId, folderId);

      // Update folder count
      targetFolder.workflowCount++;
      targetFolder.updatedAt = new Date();
    } else {
      // Remove from folder
      workflowFolders.delete(workflowId);
    }

    logger.info('Moved workflow to folder', { workflowId, folderId });

    return true;
  }

  /**
   * Move multiple workflows to folder
   */
  async moveWorkflowsToFolder(workflowIds: string[], folderId: string | null): Promise<MoveResult> {
    const movedItems: string[] = [];
    const errors: string[] = [];

    for (const workflowId of workflowIds) {
      try {
        await this.moveWorkflowToFolder(workflowId, folderId);
        movedItems.push(workflowId);
      } catch (error: any) {
        errors.push(`${workflowId}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      movedItems,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get workflow's folder
   */
  getWorkflowFolder(workflowId: string): Folder | null {
    const folderId = workflowFolders.get(workflowId);
    if (!folderId) return null;
    return folderStore.get(folderId) || null;
  }

  // ============================================================================
  // SEARCH & FILTER
  // ============================================================================

  /**
   * Search folders by name
   */
  searchFolders(userId: string, query: string): Folder[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(folderStore.values())
      .filter(f => f.ownerId === userId && f.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get folder by path
   */
  getFolderByPath(userId: string, path: string): Folder | undefined {
    return Array.from(folderStore.values())
      .find(f => f.ownerId === userId && f.path === path);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private isDescendant(folderId: string, potentialAncestorId: string): boolean {
    let current = folderStore.get(folderId);

    while (current && current.parentId) {
      if (current.parentId === potentialAncestorId) {
        return true;
      }
      current = folderStore.get(current.parentId);
    }

    return false;
  }

  private async updateChildPaths(folderId: string, oldPath: string, newPath: string): Promise<void> {
    const folder = folderStore.get(folderId);
    if (!folder) return;

    const children = this.getChildFolders(folderId, folder.ownerId);

    for (const child of children) {
      child.path = child.path.replace(oldPath, newPath);
      child.updatedAt = new Date();

      // Recurse
      await this.updateChildPaths(child.id, oldPath, newPath);
    }
  }

  /**
   * Reorder folders
   */
  async reorderFolders(folderId: string, newSortOrder: number): Promise<void> {
    const folder = folderStore.get(folderId);
    if (!folder) return;

    const siblings = this.getChildFolders(folder.parentId, folder.ownerId);

    // Shift other folders
    for (const sibling of siblings) {
      if (sibling.id !== folderId) {
        if (sibling.sortOrder >= newSortOrder && sibling.sortOrder < folder.sortOrder) {
          sibling.sortOrder++;
        } else if (sibling.sortOrder <= newSortOrder && sibling.sortOrder > folder.sortOrder) {
          sibling.sortOrder--;
        }
      }
    }

    folder.sortOrder = newSortOrder;
    folder.updatedAt = new Date();
  }

  /**
   * Duplicate folder structure
   */
  async duplicateFolder(folderId: string, newName: string, userId: string): Promise<Folder> {
    const source = folderStore.get(folderId);
    if (!source) {
      throw new Error('Source folder not found');
    }

    // Create new folder
    const newFolder = await this.createFolder({
      name: newName,
      description: source.description,
      parentId: source.parentId || undefined,
      ownerId: userId,
      color: source.color,
      icon: source.icon,
    });

    // Recursively duplicate children
    const children = this.getChildFolders(folderId, source.ownerId);
    for (const child of children) {
      const newChild = await this.duplicateFolder(child.id, child.name, userId);
      await this.moveFolder(newChild.id, newFolder.id);
    }

    return newFolder;
  }
}

// Export singleton instance
export const workflowFolderService = new WorkflowFolderService();

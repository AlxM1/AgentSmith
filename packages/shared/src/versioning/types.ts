/**
 * Workflow Versioning System Types
 * Provides version control for workflows similar to Git
 */

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  versionNumber: number;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  nodes: any[];
  connections: any[];
  settings: Record<string, any>;
  variables: Record<string, any>;
  hash: string;
  parentVersionId?: string;
  isActive: boolean;
  isPublished: boolean;
  tags: string[];
}

export interface WorkflowVersionDiff {
  versionA: string;
  versionB: string;
  changes: {
    nodes: {
      added: any[];
      removed: any[];
      modified: Array<{
        nodeId: string;
        before: any;
        after: any;
        changes: string[];
      }>;
    };
    connections: {
      added: any[];
      removed: any[];
    };
    settings: {
      before: Record<string, any>;
      after: Record<string, any>;
      changedKeys: string[];
    };
  };
  summary: string;
}

export interface WorkflowVersionCreateInput {
  workflowId: string;
  name?: string;
  description?: string;
  createdBy: string;
  nodes: any[];
  connections: any[];
  settings?: Record<string, any>;
  variables?: Record<string, any>;
  tags?: string[];
}

export interface WorkflowVersionRestoreOptions {
  versionId: string;
  createNewVersion?: boolean;
  keepCurrentActive?: boolean;
}

export interface WorkflowVersionHistory {
  workflowId: string;
  currentVersion: number;
  versions: WorkflowVersion[];
  totalVersions: number;
}

export interface WorkflowVersionTag {
  id: string;
  versionId: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
}

export interface WorkflowVersionCompareResult {
  identical: boolean;
  diff: WorkflowVersionDiff | null;
  similarity: number;
}

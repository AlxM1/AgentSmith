// Workflow Type Definitions

import type { INode, IConnection } from './node.js';

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'error';

export interface IWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: INode[];
  connections: IConnection[];
  settings: IWorkflowSettings;
  staticData?: Record<string, unknown>;
  tags: string[];
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface IWorkflowSettings {
  executionOrder: 'v1' | 'v2';
  saveExecutionProgress: boolean;
  saveManualExecutions: boolean;
  saveDataSuccessExecution: 'all' | 'none';
  saveDataErrorExecution: 'all' | 'none';
  timeout: number;
  timezone: string;
  errorWorkflow?: string;
  callerPolicy: 'any' | 'workflowsFromSameOwner' | 'none';
}

export interface IWorkflowCreateInput {
  name: string;
  description?: string;
  nodes?: INode[];
  connections?: IConnection[];
  settings?: Partial<IWorkflowSettings>;
  tags?: string[];
}

export interface IWorkflowUpdateInput {
  name?: string;
  description?: string;
  nodes?: INode[];
  connections?: IConnection[];
  settings?: Partial<IWorkflowSettings>;
  tags?: string[];
  status?: WorkflowStatus;
}

export interface IWorkflowListItem {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  nodeCount: number;
  lastExecutionStatus?: string;
  lastExecutionDate?: Date;
}

export interface IWorkflowExport {
  name: string;
  nodes: INode[];
  connections: IConnection[];
  settings: IWorkflowSettings;
  staticData?: Record<string, unknown>;
  tags: string[];
}

export const defaultWorkflowSettings: IWorkflowSettings = {
  executionOrder: 'v2',
  saveExecutionProgress: true,
  saveManualExecutions: true,
  saveDataSuccessExecution: 'all',
  saveDataErrorExecution: 'all',
  timeout: 3600,
  timezone: 'UTC',
  callerPolicy: 'workflowsFromSameOwner',
};

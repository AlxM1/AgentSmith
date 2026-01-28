/**
 * Sub-Workflow Execution Types
 * Enables workflows to call other workflows
 */

export interface SubWorkflowInput {
  workflowId: string;
  versionId?: string;
  inputData: Record<string, any>;
  options?: SubWorkflowOptions;
}

export interface SubWorkflowOptions {
  /** Wait for the sub-workflow to complete before continuing */
  waitForCompletion?: boolean;
  /** Timeout in milliseconds for sub-workflow execution */
  timeout?: number;
  /** Maximum recursion depth to prevent infinite loops */
  maxDepth?: number;
  /** Pass error to parent workflow instead of failing */
  continueOnFail?: boolean;
  /** Override credentials for the sub-workflow */
  credentialOverrides?: Record<string, any>;
  /** Static data to pass between executions */
  staticData?: Record<string, any>;
}

export interface SubWorkflowResult {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: Date;
  finishedAt?: Date;
  outputData?: Record<string, any>[];
  error?: {
    message: string;
    stack?: string;
    node?: string;
  };
  metadata: {
    depth: number;
    parentExecutionId?: string;
    duration?: number;
    nodeCount: number;
  };
}

export interface SubWorkflowReference {
  type: 'id' | 'name' | 'tag';
  value: string;
  version?: 'latest' | 'published' | number;
}

export interface SubWorkflowMapping {
  /** Map parent workflow data to sub-workflow input */
  inputMapping: Record<string, string>;
  /** Map sub-workflow output back to parent */
  outputMapping: Record<string, string>;
}

export interface SubWorkflowCall {
  id: string;
  parentExecutionId: string;
  parentNodeId: string;
  subWorkflowId: string;
  subWorkflowExecutionId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  inputData: any;
  outputData?: any;
  error?: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ExecuteSubWorkflowNode {
  workflowReference: SubWorkflowReference;
  mapping?: SubWorkflowMapping;
  options?: SubWorkflowOptions;
}

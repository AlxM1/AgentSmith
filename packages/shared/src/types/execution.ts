// Execution Type Definitions

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting';

export interface IExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: Date;
  finishedAt?: Date;
  data?: IExecutionData;
  error?: IExecutionError;
  retryOf?: string;
  retrySuccessId?: string;
}

export type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'retry' | 'internal' | 'cli';

export interface IExecutionData {
  resultData: IExecutionResultData;
  executionData?: {
    contextData: Record<string, unknown>;
    nodeExecutionStack: INodeExecutionStackItem[];
    waitingExecution: Record<string, IWaitingExecution>;
    waitingExecutionSource: Record<string, IWaitingExecutionSource>;
  };
  startData?: {
    destinationNode?: string;
    runNodeFilter?: string[];
  };
}

export interface IExecutionResultData {
  runData: IRunData;
  pinData?: Record<string, INodeExecutionOutput[]>;
  lastNodeExecuted?: string;
  metadata?: Record<string, unknown>;
  // Effective status after node-level error escalation (set by WorkflowExecutor)
  status?: 'success' | 'failed';
}

export interface IRunData {
  [nodeName: string]: INodeRunData[];
}

export interface INodeRunData {
  startTime: number;
  executionTime: number;
  executionStatus: 'success' | 'error' | 'cancelled';
  data?: INodeExecutionData;
  error?: IExecutionError;
  source: INodeExecutionSource[] | null;
}

export interface INodeExecutionData {
  main: INodeExecutionOutput[][];
}

export interface INodeExecutionOutput {
  json: Record<string, unknown>;
  binary?: Record<string, IBinaryData>;
  pairedItem?: IPairedItem | IPairedItem[];
}

export interface IBinaryData {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  fileExtension?: string;
  directory?: string;
  id?: string;
}

export interface IPairedItem {
  item: number;
  input?: number;
  sourceOverwrite?: INodeExecutionSource;
}

export interface INodeExecutionSource {
  previousNode: string;
  previousNodeOutput?: number;
  previousNodeRun?: number;
}

export interface INodeExecutionStackItem {
  node: string;
  data: INodeExecutionData;
  source: INodeExecutionSource[] | null;
}

export interface IWaitingExecution {
  main: INodeExecutionOutput[][];
}

export interface IWaitingExecutionSource {
  main: INodeExecutionSource[][];
}

export interface IExecutionError {
  message: string;
  stack?: string;
  name?: string;
  node?: {
    name: string;
    type: string;
  };
  timestamp: number;
  cause?: unknown;
}

export interface IExecutionListItem {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: Date;
  finishedAt?: Date;
  stoppedAt?: Date;
  retryOf?: string;
  retrySuccessId?: string;
}

export interface IExecutionFlattened {
  id: string;
  data: string;
  mode: ExecutionMode;
  status: ExecutionStatus;
  startedAt: Date;
  finishedAt?: Date;
  workflowId: string;
}

export interface IExecutionDeleteFilter {
  ids?: string[];
  startedBefore?: Date;
  startedAfter?: Date;
  status?: ExecutionStatus[];
}

export interface IExecutionStats {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  cancelled: number;
}

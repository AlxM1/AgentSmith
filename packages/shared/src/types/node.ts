// Node Type Definitions

export type NodeCategory = 'trigger' | 'action' | 'transform' | 'flow' | 'ai' | 'integration' | 'utility';

export interface INodePosition {
  x: number;
  y: number;
}

export interface INode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: INodePosition;
  parameters: Record<string, unknown>;
  credentials?: Record<string, INodeCredential>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  continueOnFail?: boolean;
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
}

export interface INodeCredential {
  id: string;
  name: string;
}

export interface IConnection {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  type?: string;
  // Alternative field names used by some workflow sources (frontend may send either format)
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface INodeTypeDescription {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  group: string[];
  version: number | number[];
  defaults: {
    name: string;
    color?: string;
  };
  inputs: INodeInputOutput[];
  outputs: INodeInputOutput[];
  properties: INodeProperty[];
  credentials?: INodeCredentialDescription[];
  category: NodeCategory;
  subcategory?: string;
  codex?: INodeCodex;
}

export interface INodeInputOutput {
  type: string;
  displayName?: string;
  required?: boolean;
  maxConnections?: number;
}

export interface INodeProperty {
  name: string;
  displayName: string;
  type: NodePropertyType;
  default?: unknown;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: INodePropertyOption[];
  displayOptions?: INodeDisplayOptions;
  typeOptions?: INodePropertyTypeOptions;
  noDataExpression?: boolean;
  routing?: INodePropertyRouting;
}

export type NodePropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'options'
  | 'multiOptions'
  | 'collection'
  | 'fixedCollection'
  | 'json'
  | 'dateTime'
  | 'color'
  | 'hidden'
  | 'resourceLocator'
  | 'resourceMapper'
  | 'filter'
  | 'assignmentCollection'
  | 'credentials';

export interface INodePropertyOption {
  name: string;
  value: string | number | boolean;
  description?: string;
  action?: string;
}

export interface INodeDisplayOptions {
  show?: Record<string, unknown[]>;
  hide?: Record<string, unknown[]>;
}

export interface INodePropertyTypeOptions {
  multipleValues?: boolean;
  multipleValueButtonText?: string;
  minValue?: number;
  maxValue?: number;
  rows?: number;
  alwaysOpenEditWindow?: boolean;
  password?: boolean;
  loadOptionsMethod?: string;
  loadOptionsDependsOn?: string[];
}

export interface INodePropertyRouting {
  send?: INodePropertyRoutingSend;
  output?: INodePropertyRoutingOutput;
}

export interface INodePropertyRoutingSend {
  type?: string;
  property?: string;
  propertyInDotNotation?: boolean;
  value?: string;
}

export interface INodePropertyRoutingOutput {
  postReceive?: INodePropertyRoutingPostReceive[];
}

export interface INodePropertyRoutingPostReceive {
  type: string;
  properties: Record<string, unknown>;
}

export interface INodeCredentialDescription {
  name: string;
  required?: boolean;
  displayOptions?: INodeDisplayOptions;
}

export interface INodeCodex {
  categories?: string[];
  subcategories?: Record<string, string[]>;
  alias?: string[];
}

// Built-in node type names
export const CORE_NODE_TYPES = {
  // Triggers
  MANUAL_TRIGGER: 'agentsmith.manualTrigger',
  WEBHOOK_TRIGGER: 'agentsmith.webhookTrigger',
  SCHEDULE_TRIGGER: 'agentsmith.scheduleTrigger',

  // Flow Control
  IF: 'agentsmith.if',
  SWITCH: 'agentsmith.switch',
  MERGE: 'agentsmith.merge',
  SPLIT: 'agentsmith.split',
  LOOP: 'agentsmith.loop',
  WAIT: 'agentsmith.wait',

  // Transform
  SET: 'agentsmith.set',
  CODE: 'agentsmith.code',
  FUNCTION: 'agentsmith.function',

  // Actions
  HTTP_REQUEST: 'agentsmith.httpRequest',
  EXECUTE_WORKFLOW: 'agentsmith.executeWorkflow',

  // AI
  AI_AGENT: 'agentsmith.aiAgent',
  AI_CHAIN: 'agentsmith.aiChain',
  AI_TOOL: 'agentsmith.aiTool',
  AI_MEMORY: 'agentsmith.aiMemory',

  // Utility
  NO_OP: 'agentsmith.noOp',
  ERROR_TRIGGER: 'agentsmith.errorTrigger',
} as const;

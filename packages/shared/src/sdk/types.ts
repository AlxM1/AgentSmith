// n8n-Compatible Type Definitions

// ============================================
// Core Data Types
// ============================================

export interface IDataObject {
  [key: string]: unknown;
}

export interface INodeExecutionData {
  json: IDataObject;
  binary?: IBinaryKeyData;
  pairedItem?: IPairedItemData | IPairedItemData[];
  error?: NodeError;
}

export interface IBinaryKeyData {
  [key: string]: IBinaryData;
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

export interface IPairedItemData {
  item: number;
  input?: number;
  sourceOverwrite?: INodeExecutionSource;
}

export interface INodeExecutionSource {
  previousNode: string;
  previousNodeOutput?: number;
  previousNodeRun?: number;
}

export interface NodeError {
  message: string;
  description?: string;
  stack?: string;
}

// ============================================
// Node Type Description
// ============================================

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  icon?: string;
  iconColor?: string;
  group: NodeGroup[];
  version: number | number[];
  subtitle?: string;
  description: string;
  defaults: INodeDefaults;
  inputs: NodeConnectionType[] | INodeInputConfiguration[];
  outputs: NodeConnectionType[] | INodeOutputConfiguration[];
  credentials?: INodeCredentialDescription[];
  properties: INodeProperties[];
  webhooks?: IWebhookDescription[];
  polling?: boolean;
  requestDefaults?: IRequestDefaults;
  requestOperations?: IRequestOperations;
  codex?: ICodex;
}

export type NodeGroup = 'trigger' | 'schedule' | 'transform' | 'output' | 'input';

export type NodeConnectionType = 'main' | 'ai_agent' | 'ai_chain' | 'ai_tool' | 'ai_memory' | 'ai_document' | 'ai_embedding' | 'ai_vectorStore' | 'ai_retriever' | 'ai_textSplitter' | 'ai_outputParser';

export interface INodeInputConfiguration {
  type: NodeConnectionType;
  displayName?: string;
  required?: boolean;
  maxConnections?: number;
}

export interface INodeOutputConfiguration {
  type: NodeConnectionType;
  displayName?: string;
}

export interface INodeDefaults {
  name: string;
  color?: string;
}

export interface INodeCredentialDescription {
  name: string;
  required?: boolean;
  displayOptions?: IDisplayOptions;
}

export interface IWebhookDescription {
  name: string;
  httpMethod: HttpMethod | string;
  responseMode: 'onReceived' | 'lastNode' | 'responseNode';
  path: string;
  isFullPath?: boolean;
  restartWebhook?: boolean;
}

export interface IRequestDefaults {
  baseURL?: string;
  url?: string;
  method?: HttpMethod;
  headers?: IDataObject;
  body?: IDataObject;
  qs?: IDataObject;
}

export interface IRequestOperations {
  pagination?: IPaginationOptions;
}

export interface IPaginationOptions {
  type: 'offset' | 'cursor' | 'generic';
  properties: IDataObject;
}

export interface ICodex {
  categories?: string[];
  subcategories?: Record<string, string[]>;
  alias?: string[];
  resources?: {
    primaryDocumentation?: { url: string }[];
    credentialDocumentation?: { url: string }[];
  };
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// ============================================
// Node Properties
// ============================================

export interface INodeProperties {
  displayName: string;
  name: string;
  type: NodePropertyType;
  default?: unknown;
  description?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  noDataExpression?: boolean;
  options?: INodePropertyOptions[];
  displayOptions?: IDisplayOptions;
  typeOptions?: INodePropertyTypeOptions;
  routing?: INodePropertyRouting;
  extractValue?: INodePropertyExtractValue;
}

export type NodePropertyType =
  | 'boolean'
  | 'collection'
  | 'color'
  | 'dateTime'
  | 'fixedCollection'
  | 'hidden'
  | 'json'
  | 'multiOptions'
  | 'notice'
  | 'number'
  | 'options'
  | 'resourceLocator'
  | 'resourceMapper'
  | 'string'
  | 'filter'
  | 'assignmentCollection'
  | 'credentials';

export interface INodePropertyOptions {
  name: string;
  value: string | number | boolean;
  description?: string;
  action?: string;
  routing?: INodePropertyRouting;
}

export interface IDisplayOptions {
  show?: Record<string, unknown[]>;
  hide?: Record<string, unknown[]>;
}

export interface INodePropertyTypeOptions {
  alwaysOpenEditWindow?: boolean;
  editor?: string;
  loadOptionsMethod?: string;
  loadOptionsDependsOn?: string[];
  maxValue?: number;
  minValue?: number;
  multipleValues?: boolean;
  multipleValueButtonText?: string;
  numberPrecision?: number;
  password?: boolean;
  rows?: number;
  sortable?: boolean;
}

export interface INodePropertyRouting {
  send?: INodePropertyRoutingSend;
  output?: INodePropertyRoutingOutput;
  operations?: INodePropertyRoutingOperations;
  request?: IRequestOptions;
}

export interface INodePropertyRoutingSend {
  type?: 'body' | 'query';
  property?: string;
  propertyInDotNotation?: boolean;
  value?: string;
  preSend?: string[];
}

export interface INodePropertyRoutingOutput {
  postReceive?: INodePropertyRoutingPostReceive[];
}

export interface INodePropertyRoutingPostReceive {
  type: string;
  properties: IDataObject;
}

export interface INodePropertyRoutingOperations {
  pagination?: IPaginationOptions;
}

export interface IRequestOptions {
  method?: HttpMethod;
  url?: string;
  baseURL?: string;
  headers?: IDataObject;
  body?: IDataObject;
  qs?: IDataObject;
  encoding?: string;
  json?: boolean;
  returnFullResponse?: boolean;
  ignoreHttpStatusErrors?: boolean;
}

export interface INodePropertyExtractValue {
  type: string;
  regex?: string;
}

// ============================================
// Credential Types
// ============================================

export interface ICredentialType {
  name: string;
  displayName: string;
  documentationUrl?: string;
  icon?: string;
  iconColor?: string;
  properties: INodeProperties[];
  authenticate?: IAuthenticate;
  preAuthentication?: IPreAuthentication;
  test?: ICredentialTestRequest;
  genericAuth?: boolean;
  extends?: string[];
}

export interface IAuthenticate {
  type: 'generic';
  properties: IAuthenticateProperties;
}

export interface IAuthenticateProperties {
  auth?: {
    username: string;
    password: string;
  };
  headers?: IDataObject;
  body?: IDataObject;
  qs?: IDataObject;
}

export interface IPreAuthentication {
  type: 'generic';
  properties: IPreAuthenticateProperties;
}

export interface IPreAuthenticateProperties {
  request: IRequestOptions;
  output: IDataObject;
}

export interface ICredentialTestRequest {
  request: IRequestOptions;
  rules?: ICredentialTestRule[];
}

export interface ICredentialTestRule {
  type: string;
  properties: IDataObject;
}

// ============================================
// Execution Context Types
// ============================================

export interface IExecuteFunctions {
  getInputData(inputIndex?: number): INodeExecutionData[];
  getNodeParameter(parameterName: string, itemIndex: number, fallbackValue?: unknown): unknown;
  getCredentials(type: string): Promise<IDataObject>;
  getNode(): INode;
  getWorkflow(): IWorkflow;
  getWorkflowStaticData(type: 'global' | 'node'): IDataObject;
  continueOnFail(): boolean;
  evaluateExpression(expression: string, itemIndex: number): unknown;
  helpers: IExecuteHelpers;
}

export interface IExecuteHelpers {
  request(options: IRequestOptions): Promise<unknown>;
  requestWithAuthentication(
    credentialType: string,
    options: IRequestOptions
  ): Promise<unknown>;
  prepareBinaryData(
    data: Buffer | string,
    fileName?: string,
    mimeType?: string
  ): Promise<IBinaryData>;
  returnJsonArray(items: IDataObject[]): INodeExecutionData[];
  constructExecutionMetaData(
    inputData: INodeExecutionData[],
    options: { itemData: IPairedItemData }
  ): INodeExecutionData[];
}

export interface IWebhookFunctions {
  getRequestObject(): IWebhookRequest;
  getResponseObject(): IWebhookResponse;
  getNodeParameter(parameterName: string, fallbackValue?: unknown): unknown;
  getCredentials(type: string): Promise<IDataObject>;
  getNode(): INode;
  getWorkflow(): IWorkflow;
  getWorkflowStaticData(type: 'global' | 'node'): IDataObject;
  helpers: IExecuteHelpers;
}

export interface IPollFunctions {
  getNodeParameter(parameterName: string, fallbackValue?: unknown): unknown;
  getCredentials(type: string): Promise<IDataObject>;
  getNode(): INode;
  getWorkflow(): IWorkflow;
  getWorkflowStaticData(type: 'global' | 'node'): IDataObject;
  helpers: IExecuteHelpers;
}

export interface ITriggerFunctions {
  emit(data: INodeExecutionData[][]): void;
  getNodeParameter(parameterName: string, fallbackValue?: unknown): unknown;
  getCredentials(type: string): Promise<IDataObject>;
  getNode(): INode;
  getWorkflow(): IWorkflow;
  getWorkflowStaticData(type: 'global' | 'node'): IDataObject;
  helpers: IExecuteHelpers;
}

export interface IWebhookRequest {
  body: IDataObject;
  headers: IDataObject;
  params: IDataObject;
  query: IDataObject;
  method: string;
  path: string;
}

export interface IWebhookResponse {
  status(code: number): IWebhookResponse;
  json(data: unknown): void;
  send(data: unknown): void;
  end(): void;
}

export interface IWebhookResponseData {
  workflowData?: INodeExecutionData[][];
  webhookResponse?: unknown;
  noWebhookResponse?: boolean;
}

export interface ITriggerResponse {
  closeFunction?: () => Promise<void>;
  manualTriggerFunction?: () => Promise<void>;
}

export interface INode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  disabled?: boolean;
  parameters: IDataObject;
  credentials?: IDataObject;
}

export interface IWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: INode[];
  connections: IDataObject;
  settings?: IDataObject;
  staticData?: IDataObject;
}

// ============================================
// Node Type Interface
// ============================================

export interface INodeType {
  description: INodeTypeDescription;
  execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  webhook?(this: IWebhookFunctions): Promise<IWebhookResponseData>;
  poll?(this: IPollFunctions): Promise<INodeExecutionData[][] | null>;
  trigger?(this: ITriggerFunctions): Promise<ITriggerResponse>;
  methods?: {
    loadOptions?: Record<string, (this: IExecuteFunctions) => Promise<INodePropertyOptions[]>>;
    credentialTest?: Record<string, (this: IExecuteFunctions, credential: IDataObject) => Promise<ICredentialTestResult>>;
  };
}

export interface ICredentialTestResult {
  status: 'OK' | 'Error';
  message?: string;
}

// ============================================
// Error Classes
// ============================================

export class NodeApiError extends Error {
  httpCode?: number;
  description?: string;

  constructor(node: INode, error: Error | IDataObject, options?: { message?: string; description?: string; httpCode?: number }) {
    super(options?.message || (error instanceof Error ? error.message : 'API Error'));
    this.name = 'NodeApiError';
    this.description = options?.description;
    this.httpCode = options?.httpCode;
  }
}

export class NodeOperationError extends Error {
  itemIndex?: number;
  description?: string;

  constructor(node: INode, message: string, options?: { itemIndex?: number; description?: string }) {
    super(message);
    this.name = 'NodeOperationError';
    this.itemIndex = options?.itemIndex;
    this.description = options?.description;
  }
}

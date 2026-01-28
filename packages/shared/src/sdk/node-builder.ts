// Node Builder - Declarative and Programmatic Node Creation

import type {
  INodeType,
  INodeTypeDescription,
  INodeProperties,
  INodePropertyOptions,
  INodeExecutionData,
  IExecuteFunctions,
  IDataObject,
  HttpMethod,
  IRequestOptions,
  IRequestDefaults,
  IWebhookFunctions,
  IWebhookResponseData,
  IPollFunctions,
  ITriggerFunctions,
  ITriggerResponse,
} from './types.js';

// ============================================
// Declarative Node Builder
// ============================================

export interface DeclarativeNodeConfig {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  group?: ('trigger' | 'transform' | 'output' | 'input')[];
  version?: number;
  subtitle?: string;
  credentials?: { name: string; required?: boolean }[];
  baseURL?: string;
  requestDefaults?: IRequestDefaults;
  properties?: INodeProperties[];
  operations?: Record<string, DeclarativeOperation>;
  resources?: Record<string, DeclarativeResource>;
}

export interface DeclarativeOperation {
  name?: string;
  description?: string;
  request: {
    method: HttpMethod;
    url: string;
    headers?: Record<string, string>;
    body?: IDataObject;
    qs?: Record<string, string>;
  };
  output?: {
    postReceive?: Array<{ type: string; properties: IDataObject }>;
  };
}

export interface DeclarativeResource {
  name: string;
  operations: Record<string, DeclarativeOperation>;
}

/**
 * Create a declarative-style node (for simple HTTP APIs)
 */
export function createDeclarativeNode(config: DeclarativeNodeConfig): INodeType {
  const properties: INodeProperties[] = [];

  // Add resource selector if resources defined
  if (config.resources && Object.keys(config.resources).length > 0) {
    properties.push({
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      default: Object.keys(config.resources)[0],
      options: Object.entries(config.resources).map(([key, resource]) => ({
        name: resource.name,
        value: key,
      })),
    });

    // Add operation selector for each resource
    for (const [resourceKey, resource] of Object.entries(config.resources)) {
      properties.push({
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: Object.keys(resource.operations)[0],
        displayOptions: {
          show: { resource: [resourceKey] },
        },
        options: Object.entries(resource.operations).map(([key, op]) => ({
          name: op.name || key,
          value: key,
          description: op.description,
          action: `${resource.name} ${op.name || key}`,
        })),
      });
    }
  } else if (config.operations && Object.keys(config.operations).length > 0) {
    // Simple operation selector
    properties.push({
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      default: Object.keys(config.operations)[0],
      options: Object.entries(config.operations).map(([key, op]) => ({
        name: op.name || key,
        value: key,
        description: op.description,
      })),
    });
  }

  // Add custom properties
  if (config.properties) {
    properties.push(...config.properties);
  }

  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon || 'file:icon.svg',
    iconColor: config.iconColor,
    group: config.group || ['transform'],
    version: config.version || 1,
    subtitle: config.subtitle || '={{$parameter["operation"]}}',
    description: config.description,
    defaults: { name: config.displayName },
    inputs: ['main'],
    outputs: ['main'],
    credentials: config.credentials,
    properties,
    requestDefaults: config.requestDefaults || (config.baseURL ? { baseURL: config.baseURL } : undefined),
  };

  return {
    description,
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const items = this.getInputData();
      const returnData: INodeExecutionData[] = [];

      for (let i = 0; i < items.length; i++) {
        try {
          const resource = this.getNodeParameter('resource', i, '') as string;
          const operation = this.getNodeParameter('operation', i, '') as string;

          // Get operation config
          let opConfig: DeclarativeOperation | undefined;
          if (config.resources && resource) {
            opConfig = config.resources[resource]?.operations[operation];
          } else if (config.operations) {
            opConfig = config.operations[operation];
          }

          if (!opConfig) {
            throw new Error(`Unknown operation: ${operation}`);
          }

          // Build request
          const requestOptions: IRequestOptions = {
            method: opConfig.request.method,
            url: opConfig.request.url,
            headers: opConfig.request.headers,
            body: opConfig.request.body,
            qs: opConfig.request.qs,
          };

          // Make request
          let response: unknown;
          if (config.credentials && config.credentials.length > 0) {
            response = await this.helpers.requestWithAuthentication(
              config.credentials[0].name,
              requestOptions
            );
          } else {
            response = await this.helpers.request(requestOptions);
          }

          // Process output
          const outputData = response as IDataObject;
          returnData.push({
            json: outputData,
            pairedItem: { item: i },
          });
        } catch (error) {
          if (this.continueOnFail()) {
            returnData.push({
              json: { error: error instanceof Error ? error.message : 'Unknown error' },
              pairedItem: { item: i },
            });
            continue;
          }
          throw error;
        }
      }

      return [returnData];
    },
  };
}

// ============================================
// Programmatic Node Builder
// ============================================

export interface ProgrammaticNodeConfig {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  group?: ('trigger' | 'transform' | 'output' | 'input')[];
  version?: number;
  subtitle?: string;
  credentials?: { name: string; required?: boolean }[];
  inputs?: string[];
  outputs?: string[];
  properties: INodeProperties[];
  execute: (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
  methods?: {
    loadOptions?: Record<string, (this: IExecuteFunctions) => Promise<INodePropertyOptions[]>>;
  };
}

/**
 * Create a programmatic-style node (for complex logic)
 */
export function createProgrammaticNode(config: ProgrammaticNodeConfig): INodeType {
  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon || 'file:icon.svg',
    iconColor: config.iconColor,
    group: config.group || ['transform'],
    version: config.version || 1,
    subtitle: config.subtitle,
    description: config.description,
    defaults: { name: config.displayName },
    inputs: (config.inputs || ['main']) as any,
    outputs: (config.outputs || ['main']) as any,
    credentials: config.credentials,
    properties: config.properties,
  };

  return {
    description,
    execute: config.execute,
    methods: config.methods,
  };
}

// ============================================
// Trigger Node Builder
// ============================================

export interface WebhookTriggerConfig {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  credentials?: { name: string; required?: boolean }[];
  properties?: INodeProperties[];
  webhookPath?: string;
  httpMethod?: HttpMethod | 'ALL';
  webhook: (this: IWebhookFunctions) => Promise<IWebhookResponseData>;
}

/**
 * Create a webhook trigger node
 */
export function createWebhookTrigger(config: WebhookTriggerConfig): INodeType {
  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon || 'file:webhook.svg',
    iconColor: config.iconColor,
    group: ['trigger'],
    version: 1,
    description: config.description,
    defaults: { name: config.displayName },
    inputs: [],
    outputs: ['main'],
    credentials: config.credentials,
    properties: config.properties || [],
    webhooks: [
      {
        name: 'default',
        httpMethod: config.httpMethod || 'POST',
        responseMode: 'onReceived',
        path: config.webhookPath || 'webhook',
      },
    ],
  };

  return {
    description,
    webhook: config.webhook,
  };
}

export interface PollingTriggerConfig {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  credentials?: { name: string; required?: boolean }[];
  properties?: INodeProperties[];
  poll: (this: IPollFunctions) => Promise<INodeExecutionData[][] | null>;
}

/**
 * Create a polling trigger node
 */
export function createPollingTrigger(config: PollingTriggerConfig): INodeType {
  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon || 'file:trigger.svg',
    iconColor: config.iconColor,
    group: ['trigger'],
    version: 1,
    description: config.description,
    defaults: { name: config.displayName },
    inputs: [],
    outputs: ['main'],
    credentials: config.credentials,
    properties: config.properties || [],
    polling: true,
  };

  return {
    description,
    poll: config.poll,
  };
}

export interface EventTriggerConfig {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  credentials?: { name: string; required?: boolean }[];
  properties?: INodeProperties[];
  trigger: (this: ITriggerFunctions) => Promise<ITriggerResponse>;
}

/**
 * Create an event-based trigger node (WebSocket, AMQP, etc.)
 */
export function createEventTrigger(config: EventTriggerConfig): INodeType {
  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: config.icon || 'file:trigger.svg',
    iconColor: config.iconColor,
    group: ['trigger'],
    version: 1,
    description: config.description,
    defaults: { name: config.displayName },
    inputs: [],
    outputs: ['main'],
    credentials: config.credentials,
    properties: config.properties || [],
  };

  return {
    description,
    trigger: config.trigger,
  };
}

// ============================================
// Helper: Property Builders
// ============================================

export const PropertyBuilder = {
  string(name: string, displayName: string, options?: Partial<INodeProperties>): INodeProperties {
    return {
      displayName,
      name,
      type: 'string',
      default: '',
      ...options,
    };
  },

  number(name: string, displayName: string, options?: Partial<INodeProperties>): INodeProperties {
    return {
      displayName,
      name,
      type: 'number',
      default: 0,
      ...options,
    };
  },

  boolean(name: string, displayName: string, options?: Partial<INodeProperties>): INodeProperties {
    return {
      displayName,
      name,
      type: 'boolean',
      default: false,
      ...options,
    };
  },

  options(
    name: string,
    displayName: string,
    optionsList: Array<{ name: string; value: string | number; description?: string }>,
    options?: Partial<INodeProperties>
  ): INodeProperties {
    return {
      displayName,
      name,
      type: 'options',
      default: optionsList[0]?.value || '',
      options: optionsList,
      ...options,
    };
  },

  multiOptions(
    name: string,
    displayName: string,
    optionsList: Array<{ name: string; value: string }>,
    options?: Partial<INodeProperties>
  ): INodeProperties {
    return {
      displayName,
      name,
      type: 'multiOptions',
      default: [],
      options: optionsList,
      ...options,
    };
  },

  json(name: string, displayName: string, options?: Partial<INodeProperties>): INodeProperties {
    return {
      displayName,
      name,
      type: 'json',
      default: '{}',
      ...options,
    };
  },

  collection(
    name: string,
    displayName: string,
    collectionOptions: INodeProperties[],
    options?: Partial<INodeProperties>
  ): INodeProperties {
    return {
      displayName,
      name,
      type: 'collection',
      default: {},
      placeholder: 'Add Option',
      options: collectionOptions as any,
      ...options,
    };
  },

  fixedCollection(
    name: string,
    displayName: string,
    collectionOptions: Array<{
      name: string;
      displayName: string;
      values: INodeProperties[];
    }>,
    options?: Partial<INodeProperties>
  ): INodeProperties {
    return {
      displayName,
      name,
      type: 'fixedCollection',
      default: {},
      options: collectionOptions as any,
      ...options,
    };
  },
};

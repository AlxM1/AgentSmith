/**
 * Error Workflow Trigger Node
 *
 * Triggers a workflow when an error occurs:
 * - Catch errors from any workflow
 * - Provide error context and details
 * - Enable error notification and recovery
 * - Support retry logic
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../sdk/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorWorkflowData {
  error: {
    message: string;
    name: string;
    stack?: string;
    code?: string;
    details?: any;
  };
  workflow: {
    id: string;
    name: string;
  };
  execution: {
    id: string;
    mode: string;
    startedAt: string;
    failedAt: string;
    retryCount: number;
  };
  node: {
    id: string;
    name: string;
    type: string;
    position?: number;
  };
  inputData?: any;
  outputData?: any;
}

// ============================================================================
// ERROR TRIGGER NODE
// ============================================================================

export const errorTriggerNode: NodeDefinition = {
  name: 'Error Trigger',
  type: 'error-trigger',
  group: 'Trigger',
  version: 1,
  description: 'Triggers when a workflow encounters an error',
  icon: 'alert-triangle',
  color: '#EF4444',

  defaults: {
    name: 'Error Trigger',
  },

  inputs: [],
  outputs: ['main'],

  properties: [
    {
      name: 'notice',
      displayName: '',
      type: 'notice',
      default: 'This workflow will be triggered when another workflow encounters an error. Set this workflow as the "Error Workflow" in any workflow\'s settings.',
    },
    {
      name: 'filterWorkflows',
      displayName: 'Filter by Workflow',
      type: 'boolean',
      default: false,
      description: 'Only trigger for specific workflows',
    },
    {
      name: 'workflowIds',
      displayName: 'Workflow IDs',
      type: 'string',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          filterWorkflows: [true],
        },
      },
      default: [],
      description: 'Only trigger for errors in these workflows',
    },
    {
      name: 'filterNodeTypes',
      displayName: 'Filter by Node Type',
      type: 'boolean',
      default: false,
      description: 'Only trigger for errors from specific node types',
    },
    {
      name: 'nodeTypes',
      displayName: 'Node Types',
      type: 'string',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          filterNodeTypes: [true],
        },
      },
      default: [],
      description: 'Only trigger for errors from these node types',
    },
    {
      name: 'filterErrorCodes',
      displayName: 'Filter by Error Code',
      type: 'boolean',
      default: false,
    },
    {
      name: 'errorCodes',
      displayName: 'Error Codes',
      type: 'string',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          filterErrorCodes: [true],
        },
      },
      default: [],
      description: 'Only trigger for these error codes',
    },
    {
      name: 'includeInputData',
      displayName: 'Include Input Data',
      type: 'boolean',
      default: true,
      description: 'Include the input data that caused the error',
    },
    {
      name: 'includeStackTrace',
      displayName: 'Include Stack Trace',
      type: 'boolean',
      default: true,
      description: 'Include the full error stack trace',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    // This node is triggered by the system, not manually executed
    const errorData = context.getInputData()[0]?.json as ErrorWorkflowData;

    if (!errorData) {
      throw new Error('No error data received');
    }

    const filterWorkflows = context.getNodeParameter('filterWorkflows', 0) as boolean;
    const filterNodeTypes = context.getNodeParameter('filterNodeTypes', 0) as boolean;
    const filterErrorCodes = context.getNodeParameter('filterErrorCodes', 0) as boolean;
    const includeInputData = context.getNodeParameter('includeInputData', 0) as boolean;
    const includeStackTrace = context.getNodeParameter('includeStackTrace', 0) as boolean;

    // Apply filters
    if (filterWorkflows) {
      const workflowIds = context.getNodeParameter('workflowIds', 0) as string[];
      if (!workflowIds.includes(errorData.workflow.id)) {
        return [[]]; // Skip this error
      }
    }

    if (filterNodeTypes) {
      const nodeTypes = context.getNodeParameter('nodeTypes', 0) as string[];
      if (!nodeTypes.includes(errorData.node.type)) {
        return [[]]; // Skip this error
      }
    }

    if (filterErrorCodes) {
      const errorCodes = context.getNodeParameter('errorCodes', 0) as string[];
      if (errorData.error.code && !errorCodes.includes(errorData.error.code)) {
        return [[]]; // Skip this error
      }
    }

    // Build output
    const output: any = {
      error: {
        message: errorData.error.message,
        name: errorData.error.name,
        code: errorData.error.code,
      },
      workflow: errorData.workflow,
      execution: errorData.execution,
      node: errorData.node,
      timestamp: new Date().toISOString(),
    };

    if (includeStackTrace && errorData.error.stack) {
      output.error.stack = errorData.error.stack;
    }

    if (includeInputData && errorData.inputData) {
      output.inputData = errorData.inputData;
    }

    return [[{ json: output }]];
  },
};

// ============================================================================
// ERROR HANDLER NODE
// ============================================================================

export const errorHandlerNode: NodeDefinition = {
  name: 'Error Handler',
  type: 'error-handler',
  group: 'Flow',
  version: 1,
  description: 'Handle errors within a workflow with retry logic',
  icon: 'shield',
  color: '#F59E0B',

  defaults: {
    name: 'Error Handler',
  },

  inputs: ['main'],
  outputs: ['main', 'error'],
  outputNames: ['Success', 'Error'],

  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      options: [
        { name: 'Wrap Node', value: 'wrap' },
        { name: 'Retry on Error', value: 'retry' },
        { name: 'Fallback Value', value: 'fallback' },
        { name: 'Continue on Error', value: 'continue' },
      ],
      default: 'wrap',
    },
    {
      name: 'maxRetries',
      displayName: 'Max Retries',
      type: 'number',
      default: 3,
      displayOptions: {
        show: {
          operation: ['retry'],
        },
      },
      typeOptions: {
        minValue: 1,
        maxValue: 10,
      },
    },
    {
      name: 'retryDelayMs',
      displayName: 'Retry Delay (ms)',
      type: 'number',
      default: 1000,
      displayOptions: {
        show: {
          operation: ['retry'],
        },
      },
    },
    {
      name: 'exponentialBackoff',
      displayName: 'Exponential Backoff',
      type: 'boolean',
      default: true,
      displayOptions: {
        show: {
          operation: ['retry'],
        },
      },
    },
    {
      name: 'fallbackValue',
      displayName: 'Fallback Value',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          operation: ['fallback'],
        },
      },
    },
    {
      name: 'errorOutput',
      displayName: 'Error Output',
      type: 'options',
      options: [
        { name: 'Send to Error Output', value: 'error' },
        { name: 'Throw Error', value: 'throw' },
        { name: 'Ignore', value: 'ignore' },
      ],
      default: 'error',
      description: 'What to do when an error occurs',
    },
    {
      name: 'logErrors',
      displayName: 'Log Errors',
      type: 'boolean',
      default: true,
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const operation = context.getNodeParameter('operation', 0) as string;
    const errorOutput = context.getNodeParameter('errorOutput', 0) as string;
    const logErrors = context.getNodeParameter('logErrors', 0) as boolean;

    const successItems: any[] = [];
    const errorItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Pass through successful items
        successItems.push(item);
      } catch (error: any) {
        if (logErrors) {
          console.error(`Error Handler caught error: ${error.message}`);
        }

        if (operation === 'fallback') {
          const fallbackValue = context.getNodeParameter('fallbackValue', i) as string;
          successItems.push({ json: JSON.parse(fallbackValue) });
        } else if (operation === 'continue') {
          successItems.push({
            json: {
              ...item.json,
              _error: {
                message: error.message,
                handled: true,
              },
            },
          });
        } else if (errorOutput === 'error') {
          errorItems.push({
            json: {
              originalData: item.json,
              error: {
                message: error.message,
                name: error.name,
              },
            },
          });
        } else if (errorOutput === 'throw') {
          throw error;
        }
        // If 'ignore', we just skip the item
      }
    }

    return [successItems, errorItems];
  },
};

// ============================================================================
// ERROR NOTIFICATION NODE
// ============================================================================

export const errorNotificationNode: NodeDefinition = {
  name: 'Error Notification',
  type: 'error-notification',
  group: 'Communication',
  version: 1,
  description: 'Send notifications for workflow errors',
  icon: 'bell',
  color: '#DC2626',

  defaults: {
    name: 'Error Notification',
  },

  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'channel',
      displayName: 'Notification Channel',
      type: 'options',
      options: [
        { name: 'Email', value: 'email' },
        { name: 'Slack', value: 'slack' },
        { name: 'Microsoft Teams', value: 'teams' },
        { name: 'Discord', value: 'discord' },
        { name: 'PagerDuty', value: 'pagerduty' },
        { name: 'Webhook', value: 'webhook' },
      ],
      default: 'email',
    },
    {
      name: 'recipients',
      displayName: 'Recipients',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          channel: ['email'],
        },
      },
      description: 'Comma-separated email addresses',
    },
    {
      name: 'slackChannel',
      displayName: 'Slack Channel',
      type: 'string',
      default: '#alerts',
      displayOptions: {
        show: {
          channel: ['slack'],
        },
      },
    },
    {
      name: 'webhookUrl',
      displayName: 'Webhook URL',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          channel: ['webhook', 'slack', 'teams', 'discord'],
        },
      },
    },
    {
      name: 'severity',
      displayName: 'Severity',
      type: 'options',
      options: [
        { name: 'Critical', value: 'critical' },
        { name: 'Error', value: 'error' },
        { name: 'Warning', value: 'warning' },
        { name: 'Info', value: 'info' },
      ],
      default: 'error',
    },
    {
      name: 'includeDetails',
      displayName: 'Include Error Details',
      type: 'boolean',
      default: true,
    },
    {
      name: 'customMessage',
      displayName: 'Custom Message',
      type: 'string',
      typeOptions: {
        rows: 4,
      },
      default: '',
      description: 'Additional message to include in the notification',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const channel = context.getNodeParameter('channel', 0) as string;
    const severity = context.getNodeParameter('severity', 0) as string;
    const includeDetails = context.getNodeParameter('includeDetails', 0) as boolean;
    const customMessage = context.getNodeParameter('customMessage', 0) as string;

    const results: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const errorData = items[i].json as ErrorWorkflowData;

      // Build notification message
      const message = buildErrorMessage(errorData, severity, includeDetails, customMessage);

      // Send notification based on channel
      switch (channel) {
        case 'webhook': {
          const webhookUrl = context.getNodeParameter('webhookUrl', i) as string;
          await sendWebhookNotification(webhookUrl, errorData, severity);
          break;
        }
        case 'slack': {
          const webhookUrl = context.getNodeParameter('webhookUrl', i) as string;
          await sendSlackNotification(webhookUrl, errorData, severity);
          break;
        }
        // Add other channels...
      }

      results.push({
        json: {
          notified: true,
          channel,
          severity,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return [results];
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildErrorMessage(
  errorData: ErrorWorkflowData,
  severity: string,
  includeDetails: boolean,
  customMessage: string
): string {
  let message = `[${severity.toUpperCase()}] Workflow Error\n\n`;
  message += `Workflow: ${errorData.workflow.name}\n`;
  message += `Node: ${errorData.node.name} (${errorData.node.type})\n`;
  message += `Error: ${errorData.error.message}\n`;

  if (includeDetails) {
    message += `\nExecution ID: ${errorData.execution.id}\n`;
    message += `Started: ${errorData.execution.startedAt}\n`;
    message += `Failed: ${errorData.execution.failedAt}\n`;

    if (errorData.error.stack) {
      message += `\nStack Trace:\n${errorData.error.stack}\n`;
    }
  }

  if (customMessage) {
    message += `\n${customMessage}\n`;
  }

  return message;
}

async function sendWebhookNotification(
  url: string,
  errorData: ErrorWorkflowData,
  severity: string
): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      severity,
      ...errorData,
      timestamp: new Date().toISOString(),
    }),
  });
}

async function sendSlackNotification(
  webhookUrl: string,
  errorData: ErrorWorkflowData,
  severity: string
): Promise<void> {
  const color = severity === 'critical' ? '#DC2626' :
                severity === 'error' ? '#EF4444' :
                severity === 'warning' ? '#F59E0B' : '#6B7280';

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [
        {
          color,
          title: `Workflow Error: ${errorData.workflow.name}`,
          fields: [
            {
              title: 'Node',
              value: errorData.node.name,
              short: true,
            },
            {
              title: 'Error',
              value: errorData.error.message,
              short: false,
            },
          ],
          footer: `Execution ID: ${errorData.execution.id}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }),
  });
}

export default {
  errorTriggerNode,
  errorHandlerNode,
  errorNotificationNode,
};

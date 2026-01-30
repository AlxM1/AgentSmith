/**
 * Wait Node
 *
 * Pause workflow execution:
 * - Wait for a specified duration
 * - Wait until a specific time
 * - Wait for a webhook callback
 * - Wait for an external event
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../sdk/types.js';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface WaitConfig {
  resumeMode: 'time' | 'webhook' | 'event' | 'approval';
  amount?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days';
  specificTime?: string;
  webhookPath?: string;
  webhookMethod?: string;
  eventName?: string;
  timeout?: number;
}

export interface WaitState {
  executionId: string;
  nodeId: string;
  resumeUrl?: string;
  resumeToken?: string;
  resumeAt?: Date;
  eventName?: string;
  createdAt: Date;
  data?: any;
}

// ============================================================================
// WAIT NODE
// ============================================================================

export const waitNode: NodeDefinition = {
  name: 'Wait',
  type: 'wait',
  group: 'Flow',
  version: 1,
  description: 'Pause workflow execution and wait for a condition',
  icon: 'clock',
  color: '#6366F1',

  defaults: {
    name: 'Wait',
  },

  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'resumeMode',
      displayName: 'Resume When',
      type: 'options',
      options: [
        { name: 'After Time Interval', value: 'time' },
        { name: 'At Specific Time', value: 'specificTime' },
        { name: 'On Webhook Call', value: 'webhook' },
        { name: 'On Event', value: 'event' },
        { name: 'On Approval', value: 'approval' },
      ],
      default: 'time',
      required: true,
    },
    // Time interval options
    {
      name: 'amount',
      displayName: 'Wait Amount',
      type: 'number',
      default: 1,
      displayOptions: {
        show: {
          resumeMode: ['time'],
        },
      },
      typeOptions: {
        minValue: 0,
      },
    },
    {
      name: 'unit',
      displayName: 'Unit',
      type: 'options',
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
        { name: 'Days', value: 'days' },
      ],
      default: 'minutes',
      displayOptions: {
        show: {
          resumeMode: ['time'],
        },
      },
    },
    // Specific time options
    {
      name: 'specificTime',
      displayName: 'Date/Time',
      type: 'dateTime',
      default: '',
      displayOptions: {
        show: {
          resumeMode: ['specificTime'],
        },
      },
    },
    {
      name: 'timezone',
      displayName: 'Timezone',
      type: 'options',
      options: [
        { name: 'UTC', value: 'UTC' },
        { name: 'Local', value: 'local' },
        { name: 'America/New_York', value: 'America/New_York' },
        { name: 'America/Los_Angeles', value: 'America/Los_Angeles' },
        { name: 'Europe/London', value: 'Europe/London' },
        { name: 'Europe/Paris', value: 'Europe/Paris' },
        { name: 'Asia/Tokyo', value: 'Asia/Tokyo' },
      ],
      default: 'UTC',
      displayOptions: {
        show: {
          resumeMode: ['specificTime'],
        },
      },
    },
    // Webhook options
    {
      name: 'webhookSuffix',
      displayName: 'Webhook Path Suffix',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resumeMode: ['webhook'],
        },
      },
      description: 'Optional suffix for the webhook URL',
    },
    {
      name: 'webhookMethod',
      displayName: 'HTTP Method',
      type: 'options',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
      ],
      default: 'POST',
      displayOptions: {
        show: {
          resumeMode: ['webhook'],
        },
      },
    },
    {
      name: 'webhookAuth',
      displayName: 'Require Authentication',
      type: 'boolean',
      default: true,
      displayOptions: {
        show: {
          resumeMode: ['webhook'],
        },
      },
    },
    // Event options
    {
      name: 'eventName',
      displayName: 'Event Name',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resumeMode: ['event'],
        },
      },
      description: 'Name of the event to wait for',
    },
    {
      name: 'eventFilter',
      displayName: 'Event Filter',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          resumeMode: ['event'],
        },
      },
      description: 'JSON filter to match event data',
    },
    // Approval options
    {
      name: 'approvers',
      displayName: 'Approvers',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resumeMode: ['approval'],
        },
      },
      description: 'Comma-separated list of approver emails',
    },
    {
      name: 'approvalType',
      displayName: 'Approval Type',
      type: 'options',
      options: [
        { name: 'Any Approver', value: 'any' },
        { name: 'All Approvers', value: 'all' },
        { name: 'Majority', value: 'majority' },
      ],
      default: 'any',
      displayOptions: {
        show: {
          resumeMode: ['approval'],
        },
      },
    },
    {
      name: 'approvalMessage',
      displayName: 'Approval Message',
      type: 'string',
      typeOptions: {
        rows: 4,
      },
      default: 'Please approve or reject this workflow execution.',
      displayOptions: {
        show: {
          resumeMode: ['approval'],
        },
      },
    },
    // Common options
    {
      name: 'timeout',
      displayName: 'Timeout',
      type: 'number',
      default: 0,
      description: 'Maximum wait time in seconds (0 = no timeout)',
      typeOptions: {
        minValue: 0,
      },
    },
    {
      name: 'timeoutAction',
      displayName: 'On Timeout',
      type: 'options',
      options: [
        { name: 'Continue', value: 'continue' },
        { name: 'Error', value: 'error' },
        { name: 'Skip', value: 'skip' },
      ],
      default: 'error',
    },
    {
      name: 'preserveData',
      displayName: 'Preserve Input Data',
      type: 'boolean',
      default: true,
      description: 'Keep input data available after wait resumes',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const resumeMode = context.getNodeParameter('resumeMode', 0) as string;
    const timeout = context.getNodeParameter('timeout', 0) as number;
    const preserveData = context.getNodeParameter('preserveData', 0) as boolean;

    // Check if this is a resume execution
    const resumeData = (context as any).getResumeData?.();
    if (resumeData) {
      return handleResume(items, resumeData, preserveData);
    }

    // Create wait state based on mode
    let waitState: WaitState;

    switch (resumeMode) {
      case 'time':
        waitState = await createTimeWait(context);
        break;
      case 'specificTime':
        waitState = await createSpecificTimeWait(context);
        break;
      case 'webhook':
        waitState = await createWebhookWait(context);
        break;
      case 'event':
        waitState = await createEventWait(context);
        break;
      case 'approval':
        waitState = await createApprovalWait(context);
        break;
      default:
        throw new Error(`Unknown resume mode: ${resumeMode}`);
    }

    // Store data for resume if needed
    if (preserveData) {
      waitState.data = items.map(item => item.json);
    }

    // Register wait state with the execution engine
    await registerWaitState(context, waitState);

    // Return special wait response
    return {
      waitState,
      action: 'wait',
    } as any;
  },
};

// ============================================================================
// WAIT STATE CREATION
// ============================================================================

async function createTimeWait(context: NodeExecutionContext): Promise<WaitState> {
  const amount = context.getNodeParameter('amount', 0) as number;
  const unit = context.getNodeParameter('unit', 0) as string;

  // Calculate resume time
  const multipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60000,
    hours: 3600000,
    days: 86400000,
  };

  const delayMs = amount * (multipliers[unit] || 60000);
  const resumeAt = new Date(Date.now() + delayMs);

  return {
    executionId: (context as any).executionId,
    nodeId: (context as any).nodeId,
    resumeAt,
    createdAt: new Date(),
  };
}

async function createSpecificTimeWait(context: NodeExecutionContext): Promise<WaitState> {
  const specificTime = context.getNodeParameter('specificTime', 0) as string;
  const timezone = context.getNodeParameter('timezone', 0) as string;

  // Parse the specific time
  let resumeAt = new Date(specificTime);

  // If the time has already passed, throw error
  if (resumeAt <= new Date()) {
    throw new Error('The specified time has already passed');
  }

  return {
    executionId: (context as any).executionId,
    nodeId: (context as any).nodeId,
    resumeAt,
    createdAt: new Date(),
  };
}

async function createWebhookWait(context: NodeExecutionContext): Promise<WaitState> {
  const webhookSuffix = context.getNodeParameter('webhookSuffix', 0) as string;
  const webhookAuth = context.getNodeParameter('webhookAuth', 0) as boolean;

  // Generate unique resume token
  const resumeToken = crypto.randomUUID();

  // Build webhook URL
  const baseUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';
  const executionId = (context as any).executionId;
  const resumeUrl = `${baseUrl}/webhooks/resume/${executionId}/${resumeToken}${webhookSuffix ? '/' + webhookSuffix : ''}`;

  return {
    executionId,
    nodeId: (context as any).nodeId,
    resumeUrl,
    resumeToken,
    createdAt: new Date(),
  };
}

async function createEventWait(context: NodeExecutionContext): Promise<WaitState> {
  const eventName = context.getNodeParameter('eventName', 0) as string;
  const eventFilter = context.getNodeParameter('eventFilter', 0) as string;

  if (!eventName) {
    throw new Error('Event name is required');
  }

  return {
    executionId: (context as any).executionId,
    nodeId: (context as any).nodeId,
    eventName,
    createdAt: new Date(),
  };
}

async function createApprovalWait(context: NodeExecutionContext): Promise<WaitState> {
  const approvers = context.getNodeParameter('approvers', 0) as string;
  const approvalType = context.getNodeParameter('approvalType', 0) as string;
  const approvalMessage = context.getNodeParameter('approvalMessage', 0) as string;

  const resumeToken = crypto.randomUUID();
  const baseUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';
  const executionId = (context as any).executionId;

  return {
    executionId,
    nodeId: (context as any).nodeId,
    resumeUrl: `${baseUrl}/approvals/${executionId}/${resumeToken}`,
    resumeToken,
    createdAt: new Date(),
  };
}

// ============================================================================
// RESUME HANDLING
// ============================================================================

function handleResume(
  originalItems: any[],
  resumeData: any,
  preserveData: boolean
): NodeOutput {
  const results: any[] = [];

  // Add resume metadata
  const resumeInfo = {
    _resumed: true,
    _resumedAt: new Date().toISOString(),
    _resumeData: resumeData.webhookData || resumeData.eventData || resumeData.approvalData,
  };

  if (preserveData && resumeData.originalData) {
    // Merge original data with resume info
    for (const data of resumeData.originalData) {
      results.push({
        json: {
          ...data,
          ...resumeInfo,
        },
      });
    }
  } else if (resumeData.webhookData) {
    // Use webhook data as output
    results.push({
      json: {
        ...resumeData.webhookData,
        ...resumeInfo,
      },
    });
  } else {
    // Pass through with resume info
    results.push({
      json: resumeInfo,
    });
  }

  return [results];
}

async function registerWaitState(context: NodeExecutionContext, state: WaitState): Promise<void> {
  // This would be implemented by the execution engine
  // to store the wait state and schedule resumption
  console.log('Registering wait state:', state);
}

// ============================================================================
// DELAY NODE (SIMPLER VERSION)
// ============================================================================

export const delayNode: NodeDefinition = {
  name: 'Delay',
  type: 'delay',
  group: 'Flow',
  version: 1,
  description: 'Add a simple delay to workflow execution',
  icon: 'hourglass',
  color: '#8B5CF6',

  defaults: {
    name: 'Delay',
  },

  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'delayType',
      displayName: 'Delay Type',
      type: 'options',
      options: [
        { name: 'Fixed Delay', value: 'fixed' },
        { name: 'Random Delay', value: 'random' },
        { name: 'Expression', value: 'expression' },
      ],
      default: 'fixed',
    },
    {
      name: 'amount',
      displayName: 'Delay Amount',
      type: 'number',
      default: 1,
      displayOptions: {
        show: {
          delayType: ['fixed'],
        },
      },
    },
    {
      name: 'unit',
      displayName: 'Unit',
      type: 'options',
      options: [
        { name: 'Milliseconds', value: 'ms' },
        { name: 'Seconds', value: 's' },
        { name: 'Minutes', value: 'm' },
      ],
      default: 's',
      displayOptions: {
        show: {
          delayType: ['fixed', 'random'],
        },
      },
    },
    {
      name: 'minAmount',
      displayName: 'Minimum',
      type: 'number',
      default: 1,
      displayOptions: {
        show: {
          delayType: ['random'],
        },
      },
    },
    {
      name: 'maxAmount',
      displayName: 'Maximum',
      type: 'number',
      default: 5,
      displayOptions: {
        show: {
          delayType: ['random'],
        },
      },
    },
    {
      name: 'delayExpression',
      displayName: 'Delay Expression (ms)',
      type: 'string',
      default: '={{ 1000 }}',
      displayOptions: {
        show: {
          delayType: ['expression'],
        },
      },
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const delayType = context.getNodeParameter('delayType', 0) as string;

    let delayMs: number;

    switch (delayType) {
      case 'fixed': {
        const amount = context.getNodeParameter('amount', 0) as number;
        const unit = context.getNodeParameter('unit', 0) as string;
        delayMs = calculateDelayMs(amount, unit);
        break;
      }
      case 'random': {
        const minAmount = context.getNodeParameter('minAmount', 0) as number;
        const maxAmount = context.getNodeParameter('maxAmount', 0) as number;
        const unit = context.getNodeParameter('unit', 0) as string;
        const randomAmount = Math.random() * (maxAmount - minAmount) + minAmount;
        delayMs = calculateDelayMs(randomAmount, unit);
        break;
      }
      case 'expression': {
        delayMs = context.getNodeParameter('delayExpression', 0) as number;
        break;
      }
      default:
        delayMs = 1000;
    }

    // Perform the delay
    await new Promise(resolve => setTimeout(resolve, delayMs));

    // Pass through items with delay info
    return [items.map(item => ({
      json: {
        ...item.json,
        _delay: {
          delayMs,
          completedAt: new Date().toISOString(),
        },
      },
    }))];
  },
};

function calculateDelayMs(amount: number, unit: string): number {
  switch (unit) {
    case 'ms': return amount;
    case 's': return amount * 1000;
    case 'm': return amount * 60000;
    default: return amount * 1000;
  }
}

export default {
  waitNode,
  delayNode,
};

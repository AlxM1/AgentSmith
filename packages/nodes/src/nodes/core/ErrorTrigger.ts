import { createProgrammaticNode } from '@agentsmith/shared';

export const ErrorTrigger = createProgrammaticNode({
  name: 'ErrorTrigger',
  displayName: 'Error Trigger',
  description: 'Triggers when an error occurs in the workflow',
  icon: 'fa:exclamation-triangle',
  group: ['trigger'],
  version: 1,
  defaults: { name: 'Error Trigger', color: '#ff6d5a' },
  inputs: [],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Trigger on Any Error', value: 'any' },
        { name: 'Trigger on Specific Node Error', value: 'specific' },
      ],
      default: 'any',
    },
    {
      displayName: 'Node Names',
      name: 'nodeNames',
      type: 'string',
      default: '',
      displayOptions: { show: { mode: ['specific'] } },
      description: 'Comma-separated list of node names to watch for errors',
    },
    {
      displayName: 'Include Error Details',
      name: 'includeErrorDetails',
      type: 'boolean',
      default: true,
      description: 'Include full error stack trace and details',
    },
    {
      displayName: 'Include Execution Data',
      name: 'includeExecutionData',
      type: 'boolean',
      default: false,
      description: 'Include the data that was being processed when error occurred',
    },
  ],
  // Error triggers are handled specially by the execution engine
  execute: async function () {
    // This node receives error data from the execution engine
    const executionData = this.getInputData();

    // The execution engine will pass error information as input
    // when an error occurs in the workflow
    return [executionData];
  },
});

// Error Trigger Node Type (for workflow parsing)
export const ErrorTriggerDescription = {
  name: 'ErrorTrigger',
  displayName: 'Error Trigger',
  group: ['trigger'],
  version: 1,
  description: 'Starts the workflow when an error occurs',
  eventTriggerDescription: 'Waiting for error...',
  activationMessage: 'Will trigger when an error occurs in this workflow',
  defaults: {
    name: 'Error Trigger',
    color: '#ff6d5a',
  },
  inputs: [],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Note',
      name: 'note',
      type: 'notice',
      default: '',
      description: 'This node will be triggered automatically when an error occurs in the workflow. Connect it to nodes that should handle the error (e.g., send notification, log error, etc.).',
    },
  ],
};

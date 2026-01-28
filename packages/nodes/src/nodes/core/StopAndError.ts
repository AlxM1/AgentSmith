import { createProgrammaticNode, NodeApiError } from '@agentsmith/shared';

export const StopAndError = createProgrammaticNode({
  name: 'StopAndError',
  displayName: 'Stop and Error',
  description: 'Stop workflow execution and throw an error',
  icon: 'fa:times-circle',
  group: ['flow'],
  version: 1,
  defaults: { name: 'Stop and Error', color: '#ff0000' },
  inputs: ['main'],
  outputs: [],
  properties: [
    {
      displayName: 'Error Type',
      name: 'errorType',
      type: 'options',
      options: [
        { name: 'Error Message', value: 'errorMessage' },
        { name: 'Error Object', value: 'errorObject' },
      ],
      default: 'errorMessage',
    },
    {
      displayName: 'Error Message',
      name: 'errorMessage',
      type: 'string',
      default: '',
      displayOptions: { show: { errorType: ['errorMessage'] } },
      description: 'The error message to throw',
      placeholder: 'An error occurred during workflow execution',
    },
    {
      displayName: 'Error Object (JSON)',
      name: 'errorObject',
      type: 'json',
      default: '{\n  "message": "Custom error",\n  "code": "CUSTOM_ERROR",\n  "details": {}\n}',
      displayOptions: { show: { errorType: ['errorObject'] } },
    },
    {
      displayName: 'Continue Workflow',
      name: 'continueWorkflow',
      type: 'boolean',
      default: false,
      description: 'If enabled, the error workflow (if configured) will be triggered',
    },
  ],
  execute: async function () {
    const items = this.getInputData();

    for (let i = 0; i < items.length; i++) {
      const errorType = this.getNodeParameter('errorType', i) as string;
      const continueWorkflow = this.getNodeParameter('continueWorkflow', i) as boolean;

      let errorToThrow: Error;

      if (errorType === 'errorMessage') {
        const errorMessage = this.getNodeParameter('errorMessage', i) as string;
        errorToThrow = new NodeApiError(this.getNode(), {
          message: errorMessage || 'Workflow stopped by Stop and Error node',
        });
      } else {
        const errorObjectJson = this.getNodeParameter('errorObject', i) as string;
        const errorObject = JSON.parse(errorObjectJson);
        errorToThrow = new NodeApiError(this.getNode(), {
          message: errorObject.message || 'Workflow stopped',
          ...errorObject,
        });
      }

      // Add metadata about intentional stop
      (errorToThrow as any).isStopAndError = true;
      (errorToThrow as any).continueWorkflow = continueWorkflow;
      (errorToThrow as any).itemIndex = i;
      (errorToThrow as any).inputData = items[i];

      throw errorToThrow;
    }

    return [[]];
  },
});

// NoOp node - does nothing, useful for flow control
export const NoOp = createProgrammaticNode({
  name: 'NoOp',
  displayName: 'No Operation',
  description: 'Does nothing - useful as a placeholder or for flow control',
  icon: 'fa:circle',
  group: ['flow'],
  version: 1,
  defaults: { name: 'No Op' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [],
  execute: async function () {
    return [this.getInputData()];
  },
});

// Respond to Webhook node
export const RespondToWebhook = createProgrammaticNode({
  name: 'RespondToWebhook',
  displayName: 'Respond to Webhook',
  description: 'Send a response back to a webhook request',
  icon: 'fa:reply',
  group: ['flow'],
  version: 1,
  defaults: { name: 'Respond to Webhook' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Respond With',
      name: 'respondWith',
      type: 'options',
      options: [
        { name: 'First Incoming Item', value: 'firstIncomingItem' },
        { name: 'Text', value: 'text' },
        { name: 'JSON', value: 'json' },
        { name: 'Binary', value: 'binary' },
        { name: 'No Data', value: 'noData' },
      ],
      default: 'firstIncomingItem',
    },
    {
      displayName: 'Response Body',
      name: 'responseBody',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { respondWith: ['text'] } },
    },
    {
      displayName: 'Response JSON',
      name: 'responseJson',
      type: 'json',
      default: '{}',
      displayOptions: { show: { respondWith: ['json'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { respondWith: ['binary'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Response Code',
          name: 'responseCode',
          type: 'number',
          default: 200,
        },
        {
          displayName: 'Response Headers',
          name: 'responseHeaders',
          type: 'fixedCollection',
          typeOptions: { multipleValues: true },
          default: {},
          options: [
            {
              displayName: 'Header',
              name: 'header',
              values: [
                { displayName: 'Name', name: 'name', type: 'string', default: '' },
                { displayName: 'Value', name: 'value', type: 'string', default: '' },
              ],
            },
          ],
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const respondWith = this.getNodeParameter('respondWith', i) as string;
      const options = this.getNodeParameter('options', i) as any;

      let responseBody: any;
      let contentType = 'application/json';

      switch (respondWith) {
        case 'firstIncomingItem':
          responseBody = items[0]?.json || {};
          break;
        case 'text':
          responseBody = this.getNodeParameter('responseBody', i) as string;
          contentType = 'text/plain';
          break;
        case 'json':
          responseBody = JSON.parse(this.getNodeParameter('responseJson', i) as string);
          break;
        case 'binary':
          const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
          responseBody = items[i]?.binary?.[binaryProperty];
          contentType = 'application/octet-stream';
          break;
        case 'noData':
          responseBody = undefined;
          break;
      }

      const headers: Record<string, string> = { 'Content-Type': contentType };
      if (options.responseHeaders?.header) {
        for (const header of options.responseHeaders.header) {
          headers[header.name] = header.value;
        }
      }

      // Store response data for webhook to pick up
      const responseData = {
        statusCode: options.responseCode || 200,
        headers,
        body: responseBody,
      };

      // This would be picked up by the webhook node
      // In actual implementation, this would be stored in execution context
      returnData.push({
        json: {
          ...items[i]?.json,
          _webhookResponse: responseData,
        },
      });
    }

    return [returnData];
  },
});

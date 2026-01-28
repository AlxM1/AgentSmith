import { createWebhookTrigger } from '@agentsmith/shared';

export const Webhook = createWebhookTrigger({
  name: 'webhook',
  displayName: 'Webhook',
  description: 'Starts workflow on webhook call',
  icon: 'fa:bolt',
  group: ['trigger'],
  version: 1,
  defaults: {
    name: 'Webhook',
  },
  webhookPath: '',
  httpMethod: 'POST',
  properties: [
    {
      displayName: 'HTTP Method',
      name: 'httpMethod',
      type: 'options',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
        { name: 'HEAD', value: 'HEAD' },
      ],
      default: 'POST',
    },
    {
      displayName: 'Path',
      name: 'path',
      type: 'string',
      default: '',
      placeholder: 'webhook-path',
      description: 'The path to listen on',
      required: true,
    },
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'options',
      options: [
        { name: 'None', value: 'none' },
        { name: 'Basic Auth', value: 'basicAuth' },
        { name: 'Header Auth', value: 'headerAuth' },
      ],
      default: 'none',
    },
    {
      displayName: 'Response Mode',
      name: 'responseMode',
      type: 'options',
      options: [
        { name: 'When Last Node Finishes', value: 'lastNode' },
        { name: 'Immediately', value: 'immediately' },
        { name: 'Using Respond to Webhook Node', value: 'responseNode' },
      ],
      default: 'lastNode',
    },
    {
      displayName: 'Response Code',
      name: 'responseCode',
      type: 'number',
      displayOptions: {
        show: {
          responseMode: ['immediately'],
        },
      },
      default: 200,
    },
    {
      displayName: 'Response Data',
      name: 'responseData',
      type: 'options',
      displayOptions: {
        show: {
          responseMode: ['lastNode'],
        },
      },
      options: [
        { name: 'All Entries', value: 'allEntries' },
        { name: 'First Entry JSON', value: 'firstEntryJson' },
        { name: 'First Entry Binary', value: 'firstEntryBinary' },
        { name: 'No Response Body', value: 'noData' },
      ],
      default: 'firstEntryJson',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Binary Property',
          name: 'binaryPropertyName',
          type: 'string',
          default: 'data',
          description: 'Name of the binary property to return when response mode is binary',
        },
        {
          displayName: 'Ignore Bots',
          name: 'ignoreBots',
          type: 'boolean',
          default: false,
          description: 'Ignore requests from known bots',
        },
        {
          displayName: 'Raw Body',
          name: 'rawBody',
          type: 'boolean',
          default: false,
          description: 'Include the raw body in the response',
        },
        {
          displayName: 'Response Content Type',
          name: 'responseContentType',
          type: 'string',
          default: '',
          placeholder: 'application/json',
        },
        {
          displayName: 'Response Headers',
          name: 'responseHeaders',
          type: 'json',
          default: '{}',
        },
      ],
    },
  ],
});

import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const HttpRequest = createProgrammaticNode({
  name: 'httpRequest',
  displayName: 'HTTP Request',
  description: 'Makes HTTP requests to APIs',
  icon: 'fa:globe',
  group: ['output'],
  version: 1,
  defaults: {
    name: 'HTTP Request',
  },
  credentials: [
    { name: 'httpBasicAuth', required: false },
    { name: 'httpHeaderAuth', required: false },
    { name: 'httpQueryAuth', required: false },
    { name: 'oAuth2Api', required: false },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Method',
      name: 'method',
      type: 'options',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
        { name: 'HEAD', value: 'HEAD' },
        { name: 'OPTIONS', value: 'OPTIONS' },
      ],
      default: 'GET',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      placeholder: 'https://api.example.com/endpoint',
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
        { name: 'Query Auth', value: 'queryAuth' },
        { name: 'OAuth2', value: 'oauth2' },
      ],
      default: 'none',
    },
    {
      displayName: 'Send Query Parameters',
      name: 'sendQuery',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'Query Parameters',
      name: 'queryParameters',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          sendQuery: [true],
        },
      },
      default: {},
      options: [
        {
          name: 'parameters',
          displayName: 'Parameter',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Send Headers',
      name: 'sendHeaders',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'Headers',
      name: 'headerParameters',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          sendHeaders: [true],
        },
      },
      default: {},
      options: [
        {
          name: 'parameters',
          displayName: 'Header',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Send Body',
      name: 'sendBody',
      type: 'boolean',
      default: false,
      displayOptions: {
        show: {
          method: ['POST', 'PUT', 'PATCH'],
        },
      },
    },
    {
      displayName: 'Body Content Type',
      name: 'bodyContentType',
      type: 'options',
      displayOptions: {
        show: {
          sendBody: [true],
        },
      },
      options: [
        { name: 'JSON', value: 'json' },
        { name: 'Form Data', value: 'formData' },
        { name: 'Form URL Encoded', value: 'formUrlEncoded' },
        { name: 'Raw', value: 'raw' },
      ],
      default: 'json',
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'json',
      displayOptions: {
        show: {
          sendBody: [true],
          bodyContentType: ['json', 'raw'],
        },
      },
      default: '{}',
    },
    {
      displayName: 'Response Format',
      name: 'responseFormat',
      type: 'options',
      options: [
        { name: 'Auto-detect', value: 'autodetect' },
        { name: 'JSON', value: 'json' },
        { name: 'Text', value: 'text' },
        { name: 'Binary', value: 'binary' },
      ],
      default: 'autodetect',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Timeout',
          name: 'timeout',
          type: 'number',
          default: 10000,
          description: 'Request timeout in milliseconds',
        },
        {
          displayName: 'Ignore SSL Issues',
          name: 'allowUnauthorizedCerts',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Follow Redirects',
          name: 'followRedirect',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Full Response',
          name: 'fullResponse',
          type: 'boolean',
          default: false,
          description: 'Return the full response object instead of just the body',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const method = this.getNodeParameter('method', i) as string;
      const url = this.getNodeParameter('url', i) as string;
      const sendQuery = this.getNodeParameter('sendQuery', i, false) as boolean;
      const sendHeaders = this.getNodeParameter('sendHeaders', i, false) as boolean;
      const sendBody = this.getNodeParameter('sendBody', i, false) as boolean;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      const requestOptions: Record<string, any> = {
        method,
        url,
        timeout: options.timeout || 10000,
        followRedirect: options.followRedirect !== false,
        rejectUnauthorized: !options.allowUnauthorizedCerts,
      };

      // Add query parameters
      if (sendQuery) {
        const queryParams = this.getNodeParameter('queryParameters.parameters', i, []) as Array<{ name: string; value: string }>;
        requestOptions.qs = {};
        for (const param of queryParams) {
          requestOptions.qs[param.name] = param.value;
        }
      }

      // Add headers
      if (sendHeaders) {
        const headerParams = this.getNodeParameter('headerParameters.parameters', i, []) as Array<{ name: string; value: string }>;
        requestOptions.headers = {};
        for (const header of headerParams) {
          requestOptions.headers[header.name] = header.value;
        }
      }

      // Add body
      if (sendBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyContentType = this.getNodeParameter('bodyContentType', i) as string;
        const body = this.getNodeParameter('body', i) as string;

        if (bodyContentType === 'json') {
          requestOptions.json = true;
          requestOptions.body = JSON.parse(body);
        } else {
          requestOptions.body = body;
        }
      }

      try {
        const response = await this.helpers.request(requestOptions);

        if (options.fullResponse) {
          returnData.push({ json: response });
        } else {
          returnData.push({
            json: typeof response === 'string' ? { data: response } : response
          });
        }
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  },
});

import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Notion = createProgrammaticNode({
  name: 'notion',
  displayName: 'Notion',
  description: 'Interact with Notion API',
  icon: 'file:notion.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Notion',
  },
  credentials: [
    { name: 'notionApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Database', value: 'database' },
        { name: 'Page', value: 'page' },
        { name: 'Block', value: 'block' },
        { name: 'User', value: 'user' },
      ],
      default: 'database',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['database'],
        },
      },
      options: [
        { name: 'Query', value: 'query' },
        { name: 'Get', value: 'get' },
        { name: 'Create Page', value: 'createPage' },
      ],
      default: 'query',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['page'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Update', value: 'update' },
        { name: 'Archive', value: 'archive' },
      ],
      default: 'create',
    },
    {
      displayName: 'Database ID',
      name: 'databaseId',
      type: 'string',
      default: '',
      required: true,
      displayOptions: {
        show: {
          resource: ['database'],
        },
      },
    },
    {
      displayName: 'Page ID',
      name: 'pageId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['page'],
          operation: ['get', 'update', 'archive'],
        },
      },
    },
    {
      displayName: 'Parent Page ID',
      name: 'parentPageId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['page'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['page'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Properties',
      name: 'properties',
      type: 'json',
      default: '{}',
      description: 'Page properties as JSON',
      displayOptions: {
        show: {
          resource: ['database'],
          operation: ['createPage'],
        },
      },
    },
    {
      displayName: 'Filter',
      name: 'filter',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          resource: ['database'],
          operation: ['query'],
        },
      },
    },
    {
      displayName: 'Sorts',
      name: 'sorts',
      type: 'json',
      default: '[]',
      displayOptions: {
        show: {
          resource: ['database'],
          operation: ['query'],
        },
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Page Size',
          name: 'page_size',
          type: 'number',
          default: 100,
          description: 'Number of results to return (max 100)',
        },
        {
          displayName: 'Start Cursor',
          name: 'start_cursor',
          type: 'string',
          default: '',
          description: 'Pagination cursor',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('notionApi');
    const baseUrl = 'https://api.notion.com/v1';

    const headers = {
      'Authorization': `Bearer ${credentials.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;

        if (resource === 'database') {
          const databaseId = this.getNodeParameter('databaseId', i) as string;

          if (operation === 'query') {
            const filter = this.getNodeParameter('filter', i) as string;
            const sorts = this.getNodeParameter('sorts', i) as string;

            const body: Record<string, any> = {};

            try {
              const parsedFilter = JSON.parse(filter);
              if (Object.keys(parsedFilter).length > 0) {
                body.filter = parsedFilter;
              }
            } catch {}

            try {
              const parsedSorts = JSON.parse(sorts);
              if (Array.isArray(parsedSorts) && parsedSorts.length > 0) {
                body.sorts = parsedSorts;
              }
            } catch {}

            if (options.page_size) body.page_size = options.page_size;
            if (options.start_cursor) body.start_cursor = options.start_cursor;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/databases/${databaseId}/query`,
              headers,
              body,
              json: true,
            });

            // Return individual results
            if (responseData.results) {
              for (const result of responseData.results) {
                returnData.push({
                  json: result,
                  pairedItem: { item: i },
                });
              }
              continue;
            }
          } else if (operation === 'get') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/databases/${databaseId}`,
              headers,
              json: true,
            });
          } else if (operation === 'createPage') {
            const properties = this.getNodeParameter('properties', i) as string;

            let parsedProperties = {};
            try {
              parsedProperties = JSON.parse(properties);
            } catch {}

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/pages`,
              headers,
              body: {
                parent: { database_id: databaseId },
                properties: parsedProperties,
              },
              json: true,
            });
          }
        } else if (resource === 'page') {
          if (operation === 'get') {
            const pageId = this.getNodeParameter('pageId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/pages/${pageId}`,
              headers,
              json: true,
            });
          } else if (operation === 'create') {
            const parentPageId = this.getNodeParameter('parentPageId', i) as string;
            const title = this.getNodeParameter('title', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/pages`,
              headers,
              body: {
                parent: { page_id: parentPageId },
                properties: {
                  title: {
                    title: [{ text: { content: title } }],
                  },
                },
              },
              json: true,
            });
          } else if (operation === 'archive') {
            const pageId = this.getNodeParameter('pageId', i) as string;

            responseData = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/pages/${pageId}`,
              headers,
              body: { archived: true },
              json: true,
            });
          }
        }

        returnData.push({
          json: responseData,
          pairedItem: { item: i },
        });
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

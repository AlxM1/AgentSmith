import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Airtable = createProgrammaticNode({
  name: 'airtable',
  displayName: 'Airtable',
  description: 'Read and write data to Airtable',
  icon: 'file:airtable.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Airtable',
  },
  credentials: [
    { name: 'airtableApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'List Records', value: 'list' },
        { name: 'Get Record', value: 'get' },
        { name: 'Create Record', value: 'create' },
        { name: 'Update Record', value: 'update' },
        { name: 'Delete Record', value: 'delete' },
        { name: 'Search Records', value: 'search' },
      ],
      default: 'list',
    },
    {
      displayName: 'Base ID',
      name: 'baseId',
      type: 'string',
      default: '',
      required: true,
      description: 'The ID of the base (starts with "app")',
    },
    {
      displayName: 'Table',
      name: 'table',
      type: 'string',
      default: '',
      required: true,
      description: 'Table name or ID',
    },
    {
      displayName: 'Record ID',
      name: 'recordId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          operation: ['get', 'update', 'delete'],
        },
      },
    },
    {
      displayName: 'Fields',
      name: 'fields',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          operation: ['create', 'update'],
        },
      },
    },
    {
      displayName: 'Filter Formula',
      name: 'filterByFormula',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          operation: ['list', 'search'],
        },
      },
      placeholder: "{Status} = 'Done'",
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Fields',
          name: 'fields',
          type: 'string',
          default: '',
          description: 'Comma-separated list of fields to return',
        },
        {
          displayName: 'Max Records',
          name: 'maxRecords',
          type: 'number',
          default: 100,
        },
        {
          displayName: 'Sort',
          name: 'sort',
          type: 'json',
          default: '[]',
          description: 'Array of sort objects: [{"field": "Name", "direction": "asc"}]',
        },
        {
          displayName: 'View',
          name: 'view',
          type: 'string',
          default: '',
          description: 'Name or ID of a view',
        },
        {
          displayName: 'Page Size',
          name: 'pageSize',
          type: 'number',
          default: 100,
        },
        {
          displayName: 'Offset',
          name: 'offset',
          type: 'string',
          default: '',
          description: 'Pagination offset',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('airtableApi');
    const baseUrl = 'https://api.airtable.com/v0';

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const baseId = this.getNodeParameter('baseId', i) as string;
      const table = this.getNodeParameter('table', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      const headers = {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json',
      };

      try {
        let responseData: any;

        if (operation === 'list' || operation === 'search') {
          const filterByFormula = this.getNodeParameter('filterByFormula', i) as string;

          const qs: Record<string, any> = {};
          if (filterByFormula) qs.filterByFormula = filterByFormula;
          if (options.fields) qs['fields[]'] = options.fields.split(',').map((f: string) => f.trim());
          if (options.maxRecords) qs.maxRecords = options.maxRecords;
          if (options.view) qs.view = options.view;
          if (options.pageSize) qs.pageSize = options.pageSize;
          if (options.offset) qs.offset = options.offset;

          if (options.sort) {
            try {
              const sortArray = JSON.parse(options.sort);
              sortArray.forEach((s: any, idx: number) => {
                qs[`sort[${idx}][field]`] = s.field;
                qs[`sort[${idx}][direction]`] = s.direction || 'asc';
              });
            } catch {}
          }

          responseData = await this.helpers.request({
            method: 'GET',
            url: `${baseUrl}/${baseId}/${encodeURIComponent(table)}`,
            headers,
            qs,
            json: true,
          });

          // Return individual records
          if (responseData.records) {
            for (const record of responseData.records) {
              returnData.push({
                json: {
                  id: record.id,
                  ...record.fields,
                  createdTime: record.createdTime,
                },
                pairedItem: { item: i },
              });
            }
            continue;
          }
        } else if (operation === 'get') {
          const recordId = this.getNodeParameter('recordId', i) as string;

          responseData = await this.helpers.request({
            method: 'GET',
            url: `${baseUrl}/${baseId}/${encodeURIComponent(table)}/${recordId}`,
            headers,
            json: true,
          });

          returnData.push({
            json: {
              id: responseData.id,
              ...responseData.fields,
              createdTime: responseData.createdTime,
            },
            pairedItem: { item: i },
          });
          continue;
        } else if (operation === 'create') {
          const fields = this.getNodeParameter('fields', i) as string;
          let parsedFields = {};

          try {
            parsedFields = JSON.parse(fields);
          } catch {}

          responseData = await this.helpers.request({
            method: 'POST',
            url: `${baseUrl}/${baseId}/${encodeURIComponent(table)}`,
            headers,
            body: {
              fields: parsedFields,
            },
            json: true,
          });

          returnData.push({
            json: {
              id: responseData.id,
              ...responseData.fields,
              createdTime: responseData.createdTime,
            },
            pairedItem: { item: i },
          });
          continue;
        } else if (operation === 'update') {
          const recordId = this.getNodeParameter('recordId', i) as string;
          const fields = this.getNodeParameter('fields', i) as string;
          let parsedFields = {};

          try {
            parsedFields = JSON.parse(fields);
          } catch {}

          responseData = await this.helpers.request({
            method: 'PATCH',
            url: `${baseUrl}/${baseId}/${encodeURIComponent(table)}/${recordId}`,
            headers,
            body: {
              fields: parsedFields,
            },
            json: true,
          });

          returnData.push({
            json: {
              id: responseData.id,
              ...responseData.fields,
            },
            pairedItem: { item: i },
          });
          continue;
        } else if (operation === 'delete') {
          const recordId = this.getNodeParameter('recordId', i) as string;

          responseData = await this.helpers.request({
            method: 'DELETE',
            url: `${baseUrl}/${baseId}/${encodeURIComponent(table)}/${recordId}`,
            headers,
            json: true,
          });
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

import { createProgrammaticNode } from '@agentsmith/shared';

export const Salesforce = createProgrammaticNode({
  name: 'Salesforce',
  displayName: 'Salesforce',
  description: 'Interact with Salesforce CRM',
  icon: 'file:salesforce.svg',
  group: ['crm'],
  version: 1,
  defaults: { name: 'Salesforce' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'salesforceOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Account', value: 'Account' },
        { name: 'Contact', value: 'Contact' },
        { name: 'Lead', value: 'Lead' },
        { name: 'Opportunity', value: 'Opportunity' },
        { name: 'Case', value: 'Case' },
        { name: 'Task', value: 'Task' },
        { name: 'Custom Object', value: 'custom' },
      ],
      default: 'Contact',
    },
    {
      displayName: 'Custom Object Name',
      name: 'customObject',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['custom'] } },
      description: 'API name of the custom object (e.g., Custom_Object__c)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Get All', value: 'getAll' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
        { name: 'SOQL Query', value: 'query' },
        { name: 'Upsert', value: 'upsert' },
      ],
      default: 'get',
    },
    {
      displayName: 'Record ID',
      name: 'recordId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['get', 'update', 'delete'] } },
    },
    {
      displayName: 'External ID Field',
      name: 'externalIdField',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upsert'] } },
      description: 'The external ID field for upsert operation',
    },
    {
      displayName: 'External ID Value',
      name: 'externalIdValue',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upsert'] } },
    },
    {
      displayName: 'Fields',
      name: 'fields',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['create', 'update', 'upsert'] } },
      options: [
        {
          displayName: 'Field',
          name: 'field',
          values: [
            { displayName: 'Field Name', name: 'name', type: 'string', default: '' },
            { displayName: 'Field Value', name: 'value', type: 'string', default: '' },
          ],
        },
      ],
    },
    {
      displayName: 'SOQL Query',
      name: 'query',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { operation: ['query'] } },
      placeholder: 'SELECT Id, Name, Email FROM Contact WHERE LastName = \'Smith\'',
    },
    {
      displayName: 'Return All',
      name: 'returnAll',
      type: 'boolean',
      default: false,
      displayOptions: { show: { operation: ['getAll', 'query'] } },
    },
    {
      displayName: 'Limit',
      name: 'limit',
      type: 'number',
      default: 50,
      displayOptions: { show: { operation: ['getAll'], returnAll: [false] } },
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
          displayName: 'Conditions',
          name: 'conditions',
          type: 'string',
          default: '',
          description: 'WHERE clause conditions (without WHERE keyword)',
        },
        {
          displayName: 'Order By',
          name: 'orderBy',
          type: 'string',
          default: '',
          description: 'Field to sort by',
        },
        {
          displayName: 'All or None',
          name: 'allOrNone',
          type: 'boolean',
          default: false,
          description: 'If true, roll back all records if any fail',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('salesforceOAuth2Api');

    const instanceUrl = credentials.instanceUrl as string;
    const accessToken = credentials.accessToken as string;
    const apiVersion = 'v58.0';

    for (let i = 0; i < items.length; i++) {
      let resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const options = this.getNodeParameter('options', i) as any;

      if (resource === 'custom') {
        resource = this.getNodeParameter('customObject', i) as string;
      }

      try {
        let result: any;

        switch (operation) {
          case 'create': {
            const fields = this.getNodeParameter('fields', i) as any;
            const body: Record<string, any> = {};

            if (fields.field) {
              for (const field of fields.field) {
                body[field.name] = parseFieldValue(field.value);
              }
            }

            result = await salesforceApiRequest(
              'POST',
              `${instanceUrl}/services/data/${apiVersion}/sobjects/${resource}`,
              body,
              accessToken
            );
            break;
          }

          case 'get': {
            const recordId = this.getNodeParameter('recordId', i) as string;
            const fields = options.fields || '';

            let url = `${instanceUrl}/services/data/${apiVersion}/sobjects/${resource}/${recordId}`;
            if (fields) url += `?fields=${fields}`;

            result = await salesforceApiRequest('GET', url, null, accessToken);
            break;
          }

          case 'getAll': {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? '' : (this.getNodeParameter('limit', i) as number);
            const fields = options.fields || 'Id, Name';
            const conditions = options.conditions || '';
            const orderBy = options.orderBy || '';

            let soql = `SELECT ${fields} FROM ${resource}`;
            if (conditions) soql += ` WHERE ${conditions}`;
            if (orderBy) soql += ` ORDER BY ${orderBy}`;
            if (limit) soql += ` LIMIT ${limit}`;

            result = await salesforceApiRequest(
              'GET',
              `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(soql)}`,
              null,
              accessToken
            );

            if (returnAll && result.nextRecordsUrl) {
              const allRecords = [...result.records];
              let nextUrl = result.nextRecordsUrl;

              while (nextUrl) {
                const nextResult = await salesforceApiRequest(
                  'GET',
                  `${instanceUrl}${nextUrl}`,
                  null,
                  accessToken
                );
                allRecords.push(...nextResult.records);
                nextUrl = nextResult.nextRecordsUrl;
              }

              result = allRecords;
            } else {
              result = result.records;
            }
            break;
          }

          case 'update': {
            const recordId = this.getNodeParameter('recordId', i) as string;
            const fields = this.getNodeParameter('fields', i) as any;
            const body: Record<string, any> = {};

            if (fields.field) {
              for (const field of fields.field) {
                body[field.name] = parseFieldValue(field.value);
              }
            }

            await salesforceApiRequest(
              'PATCH',
              `${instanceUrl}/services/data/${apiVersion}/sobjects/${resource}/${recordId}`,
              body,
              accessToken
            );
            result = { success: true, id: recordId };
            break;
          }

          case 'delete': {
            const recordId = this.getNodeParameter('recordId', i) as string;

            await salesforceApiRequest(
              'DELETE',
              `${instanceUrl}/services/data/${apiVersion}/sobjects/${resource}/${recordId}`,
              null,
              accessToken
            );
            result = { success: true, id: recordId };
            break;
          }

          case 'query': {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;

            result = await salesforceApiRequest(
              'GET',
              `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(query)}`,
              null,
              accessToken
            );

            if (returnAll && result.nextRecordsUrl) {
              const allRecords = [...result.records];
              let nextUrl = result.nextRecordsUrl;

              while (nextUrl) {
                const nextResult = await salesforceApiRequest(
                  'GET',
                  `${instanceUrl}${nextUrl}`,
                  null,
                  accessToken
                );
                allRecords.push(...nextResult.records);
                nextUrl = nextResult.nextRecordsUrl;
              }

              result = allRecords;
            } else {
              result = result.records;
            }
            break;
          }

          case 'upsert': {
            const externalIdField = this.getNodeParameter('externalIdField', i) as string;
            const externalIdValue = this.getNodeParameter('externalIdValue', i) as string;
            const fields = this.getNodeParameter('fields', i) as any;
            const body: Record<string, any> = {};

            if (fields.field) {
              for (const field of fields.field) {
                body[field.name] = parseFieldValue(field.value);
              }
            }

            result = await salesforceApiRequest(
              'PATCH',
              `${instanceUrl}/services/data/${apiVersion}/sobjects/${resource}/${externalIdField}/${externalIdValue}`,
              body,
              accessToken
            );
            break;
          }
        }

        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
          returnData.push({ json: row });
        }
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

function parseFieldValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  const num = Number(value);
  if (!isNaN(num) && String(num) === value) return num;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function salesforceApiRequest(
  method: string,
  url: string,
  body: any,
  accessToken: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };

  const text = await response.text();
  return text ? JSON.parse(text) : { success: true };
}

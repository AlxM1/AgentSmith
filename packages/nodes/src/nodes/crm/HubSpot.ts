import { createProgrammaticNode } from '@agentsmith/shared';

export const HubSpot = createProgrammaticNode({
  name: 'HubSpot',
  displayName: 'HubSpot',
  description: 'Interact with HubSpot CRM',
  icon: 'file:hubspot.svg',
  group: ['crm'],
  version: 1,
  defaults: { name: 'HubSpot' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'hubspotApi', required: true }],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Contact', value: 'contact' },
        { name: 'Company', value: 'company' },
        { name: 'Deal', value: 'deal' },
        { name: 'Ticket', value: 'ticket' },
        { name: 'Engagement', value: 'engagement' },
        { name: 'Form', value: 'form' },
      ],
      default: 'contact',
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
        { name: 'Search', value: 'search' },
      ],
      default: 'get',
    },
    {
      displayName: 'Contact ID',
      name: 'contactId',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['contact'], operation: ['get', 'update', 'delete'] } },
    },
    {
      displayName: 'Company ID',
      name: 'companyId',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['company'], operation: ['get', 'update', 'delete'] } },
    },
    {
      displayName: 'Deal ID',
      name: 'dealId',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['deal'], operation: ['get', 'update', 'delete'] } },
    },
    {
      displayName: 'Ticket ID',
      name: 'ticketId',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['ticket'], operation: ['get', 'update', 'delete'] } },
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
    },
    {
      displayName: 'Additional Fields',
      name: 'additionalFields',
      type: 'collection',
      placeholder: 'Add Field',
      default: {},
      displayOptions: { show: { operation: ['create', 'update'] } },
      options: [
        { displayName: 'First Name', name: 'firstname', type: 'string', default: '' },
        { displayName: 'Last Name', name: 'lastname', type: 'string', default: '' },
        { displayName: 'Phone', name: 'phone', type: 'string', default: '' },
        { displayName: 'Website', name: 'website', type: 'string', default: '' },
        { displayName: 'Company', name: 'company', type: 'string', default: '' },
        { displayName: 'Job Title', name: 'jobtitle', type: 'string', default: '' },
        { displayName: 'Lifecycle Stage', name: 'lifecyclestage', type: 'options', options: [
          { name: 'Subscriber', value: 'subscriber' },
          { name: 'Lead', value: 'lead' },
          { name: 'Marketing Qualified Lead', value: 'marketingqualifiedlead' },
          { name: 'Sales Qualified Lead', value: 'salesqualifiedlead' },
          { name: 'Opportunity', value: 'opportunity' },
          { name: 'Customer', value: 'customer' },
          { name: 'Evangelist', value: 'evangelist' },
        ], default: 'subscriber' },
        { displayName: 'Name', name: 'name', type: 'string', default: '' },
        { displayName: 'Domain', name: 'domain', type: 'string', default: '' },
        { displayName: 'Industry', name: 'industry', type: 'string', default: '' },
        { displayName: 'Deal Name', name: 'dealname', type: 'string', default: '' },
        { displayName: 'Amount', name: 'amount', type: 'number', default: 0 },
        { displayName: 'Pipeline', name: 'pipeline', type: 'string', default: '' },
        { displayName: 'Deal Stage', name: 'dealstage', type: 'string', default: '' },
        { displayName: 'Close Date', name: 'closedate', type: 'dateTime', default: '' },
        { displayName: 'Subject', name: 'subject', type: 'string', default: '' },
        { displayName: 'Content', name: 'content', type: 'string', default: '' },
        { displayName: 'Priority', name: 'hs_ticket_priority', type: 'options', options: [
          { name: 'Low', value: 'LOW' },
          { name: 'Medium', value: 'MEDIUM' },
          { name: 'High', value: 'HIGH' },
        ], default: 'LOW' },
      ],
    },
    {
      displayName: 'Search Query',
      name: 'searchQuery',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Filter Groups',
      name: 'filterGroups',
      type: 'json',
      default: '[]',
      displayOptions: { show: { operation: ['search'] } },
      description: 'HubSpot filter groups for advanced search',
    },
    {
      displayName: 'Return All',
      name: 'returnAll',
      type: 'boolean',
      default: false,
      displayOptions: { show: { operation: ['getAll', 'search'] } },
    },
    {
      displayName: 'Limit',
      name: 'limit',
      type: 'number',
      default: 50,
      displayOptions: { show: { operation: ['getAll', 'search'], returnAll: [false] } },
    },
    {
      displayName: 'Properties',
      name: 'properties',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['get', 'getAll', 'search'] } },
      description: 'Comma-separated list of properties to return',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('hubspotApi');

    const apiKey = credentials.apiKey as string;
    const baseUrl = 'https://api.hubapi.com';

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      try {
        let result: any;
        const endpoint = getEndpoint(resource);

        switch (operation) {
          case 'create': {
            const additionalFields = this.getNodeParameter('additionalFields', i) as any;
            const properties: Record<string, any> = { ...additionalFields };

            if (resource === 'contact') {
              const email = this.getNodeParameter('email', i) as string;
              if (email) properties.email = email;
            }

            result = await hubspotApiRequest(
              'POST',
              `${baseUrl}/crm/v3/objects/${endpoint}`,
              { properties },
              apiKey
            );
            break;
          }

          case 'get': {
            const id = this.getNodeParameter(`${resource}Id`, i) as string;
            const properties = this.getNodeParameter('properties', i) as string;
            const params: Record<string, string> = {};
            if (properties) params.properties = properties;

            result = await hubspotApiRequest(
              'GET',
              `${baseUrl}/crm/v3/objects/${endpoint}/${id}`,
              null,
              apiKey,
              params
            );
            break;
          }

          case 'getAll': {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? 100 : (this.getNodeParameter('limit', i) as number);
            const properties = this.getNodeParameter('properties', i) as string;
            const params: Record<string, any> = { limit };
            if (properties) params.properties = properties;

            if (returnAll) {
              result = await hubspotApiRequestAllItems(
                'GET',
                `${baseUrl}/crm/v3/objects/${endpoint}`,
                apiKey,
                params
              );
            } else {
              result = await hubspotApiRequest(
                'GET',
                `${baseUrl}/crm/v3/objects/${endpoint}`,
                null,
                apiKey,
                params
              );
              result = result.results || [];
            }
            break;
          }

          case 'update': {
            const id = this.getNodeParameter(`${resource}Id`, i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as any;

            result = await hubspotApiRequest(
              'PATCH',
              `${baseUrl}/crm/v3/objects/${endpoint}/${id}`,
              { properties: additionalFields },
              apiKey
            );
            break;
          }

          case 'delete': {
            const id = this.getNodeParameter(`${resource}Id`, i) as string;

            await hubspotApiRequest(
              'DELETE',
              `${baseUrl}/crm/v3/objects/${endpoint}/${id}`,
              null,
              apiKey
            );
            result = { success: true, id };
            break;
          }

          case 'search': {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? 100 : (this.getNodeParameter('limit', i) as number);
            const searchQuery = this.getNodeParameter('searchQuery', i) as string;
            const filterGroupsJson = this.getNodeParameter('filterGroups', i) as string;
            const properties = this.getNodeParameter('properties', i) as string;

            const body: any = { limit };
            if (searchQuery) body.query = searchQuery;
            if (filterGroupsJson && filterGroupsJson !== '[]') {
              body.filterGroups = JSON.parse(filterGroupsJson);
            }
            if (properties) body.properties = properties.split(',').map(p => p.trim());

            result = await hubspotApiRequest(
              'POST',
              `${baseUrl}/crm/v3/objects/${endpoint}/search`,
              body,
              apiKey
            );
            result = result.results || [];
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

function getEndpoint(resource: string): string {
  const endpoints: Record<string, string> = {
    contact: 'contacts',
    company: 'companies',
    deal: 'deals',
    ticket: 'tickets',
    engagement: 'engagements',
    form: 'forms',
  };
  return endpoints[resource] || resource;
}

async function hubspotApiRequest(
  method: string,
  url: string,
  body: any,
  apiKey: string,
  params?: Record<string, any>
): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const urlObj = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      urlObj.searchParams.append(key, String(value));
    }
  }

  const response = await fetch(urlObj.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function hubspotApiRequestAllItems(
  method: string,
  url: string,
  apiKey: string,
  params: Record<string, any>
): Promise<any[]> {
  const allItems: any[] = [];
  let after: string | undefined;

  do {
    if (after) params.after = after;
    const response = await hubspotApiRequest(method, url, null, apiKey, params);
    allItems.push(...(response.results || []));
    after = response.paging?.next?.after;
  } while (after);

  return allItems;
}

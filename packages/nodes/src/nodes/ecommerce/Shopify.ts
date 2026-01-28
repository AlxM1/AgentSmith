import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Shopify = createProgrammaticNode({
  name: 'shopify',
  displayName: 'Shopify',
  description: 'Interact with Shopify API',
  icon: 'file:shopify.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Shopify',
  },
  credentials: [
    { name: 'shopifyApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Product', value: 'product' },
        { name: 'Order', value: 'order' },
        { name: 'Customer', value: 'customer' },
        { name: 'Inventory', value: 'inventory' },
      ],
      default: 'product',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['product'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Get Many', value: 'getAll' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
      ],
      default: 'getAll',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['order'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Get Many', value: 'getAll' },
        { name: 'Update', value: 'update' },
        { name: 'Close', value: 'close' },
        { name: 'Cancel', value: 'cancel' },
      ],
      default: 'getAll',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['customer'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Get Many', value: 'getAll' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
      ],
      default: 'getAll',
    },
    {
      displayName: 'Product ID',
      name: 'productId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['product'],
          operation: ['get', 'update', 'delete'],
        },
      },
    },
    {
      displayName: 'Order ID',
      name: 'orderId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['order'],
          operation: ['get', 'update', 'close', 'cancel'],
        },
      },
    },
    {
      displayName: 'Customer ID',
      name: 'customerId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['customer'],
          operation: ['get', 'update', 'delete'],
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
          resource: ['product'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Additional Fields',
      name: 'additionalFields',
      type: 'json',
      default: '{}',
      description: 'Additional fields to include in the request',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Limit',
          name: 'limit',
          type: 'number',
          default: 50,
        },
        {
          displayName: 'Status',
          name: 'status',
          type: 'options',
          options: [
            { name: 'Any', value: 'any' },
            { name: 'Open', value: 'open' },
            { name: 'Closed', value: 'closed' },
            { name: 'Cancelled', value: 'cancelled' },
          ],
          default: 'any',
        },
        {
          displayName: 'Since ID',
          name: 'since_id',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Created At Min',
          name: 'created_at_min',
          type: 'dateTime',
          default: '',
        },
        {
          displayName: 'Created At Max',
          name: 'created_at_max',
          type: 'dateTime',
          default: '',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('shopifyApi');

    const shopName = credentials.shopName as string;
    const apiVersion = (credentials.apiVersion as string) || '2024-01';
    const baseUrl = `https://${shopName}.myshopify.com/admin/api/${apiVersion}`;

    const headers = {
      'X-Shopify-Access-Token': credentials.accessToken as string,
      'Content-Type': 'application/json',
    };

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;
        let additionalFields = {};

        try {
          additionalFields = JSON.parse(this.getNodeParameter('additionalFields', i) as string);
        } catch {}

        if (resource === 'product') {
          if (operation === 'getAll') {
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.since_id) qs.since_id = options.since_id;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/products.json`,
              headers,
              qs,
              json: true,
            });

            if (responseData.products) {
              for (const product of responseData.products) {
                returnData.push({
                  json: product,
                  pairedItem: { item: i },
                });
              }
              continue;
            }
          } else if (operation === 'get') {
            const productId = this.getNodeParameter('productId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/products/${productId}.json`,
              headers,
              json: true,
            });
            responseData = responseData.product;
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/products.json`,
              headers,
              body: {
                product: {
                  title,
                  ...additionalFields,
                },
              },
              json: true,
            });
            responseData = responseData.product;
          } else if (operation === 'update') {
            const productId = this.getNodeParameter('productId', i) as string;

            responseData = await this.helpers.request({
              method: 'PUT',
              url: `${baseUrl}/products/${productId}.json`,
              headers,
              body: {
                product: {
                  id: productId,
                  ...additionalFields,
                },
              },
              json: true,
            });
            responseData = responseData.product;
          } else if (operation === 'delete') {
            const productId = this.getNodeParameter('productId', i) as string;

            await this.helpers.request({
              method: 'DELETE',
              url: `${baseUrl}/products/${productId}.json`,
              headers,
              json: true,
            });
            responseData = { deleted: true, id: productId };
          }
        } else if (resource === 'order') {
          if (operation === 'getAll') {
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.status && options.status !== 'any') qs.status = options.status;
            if (options.since_id) qs.since_id = options.since_id;
            if (options.created_at_min) qs.created_at_min = options.created_at_min;
            if (options.created_at_max) qs.created_at_max = options.created_at_max;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/orders.json`,
              headers,
              qs,
              json: true,
            });

            if (responseData.orders) {
              for (const order of responseData.orders) {
                returnData.push({
                  json: order,
                  pairedItem: { item: i },
                });
              }
              continue;
            }
          } else if (operation === 'get') {
            const orderId = this.getNodeParameter('orderId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/orders/${orderId}.json`,
              headers,
              json: true,
            });
            responseData = responseData.order;
          } else if (operation === 'close') {
            const orderId = this.getNodeParameter('orderId', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/orders/${orderId}/close.json`,
              headers,
              json: true,
            });
            responseData = responseData.order;
          } else if (operation === 'cancel') {
            const orderId = this.getNodeParameter('orderId', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/orders/${orderId}/cancel.json`,
              headers,
              json: true,
            });
            responseData = responseData.order;
          }
        } else if (resource === 'customer') {
          if (operation === 'getAll') {
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.since_id) qs.since_id = options.since_id;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/customers.json`,
              headers,
              qs,
              json: true,
            });

            if (responseData.customers) {
              for (const customer of responseData.customers) {
                returnData.push({
                  json: customer,
                  pairedItem: { item: i },
                });
              }
              continue;
            }
          } else if (operation === 'get') {
            const customerId = this.getNodeParameter('customerId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/customers/${customerId}.json`,
              headers,
              json: true,
            });
            responseData = responseData.customer;
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

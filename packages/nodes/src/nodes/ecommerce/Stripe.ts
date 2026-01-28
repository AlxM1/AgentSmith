import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Stripe = createProgrammaticNode({
  name: 'stripe',
  displayName: 'Stripe',
  description: 'Interact with Stripe API',
  icon: 'file:stripe.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Stripe',
  },
  credentials: [
    { name: 'stripeApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Customer', value: 'customer' },
        { name: 'Charge', value: 'charge' },
        { name: 'Payment Intent', value: 'paymentIntent' },
        { name: 'Invoice', value: 'invoice' },
        { name: 'Subscription', value: 'subscription' },
        { name: 'Product', value: 'product' },
        { name: 'Price', value: 'price' },
      ],
      default: 'customer',
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
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
        { name: 'List', value: 'list' },
      ],
      default: 'create',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['paymentIntent'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'Confirm', value: 'confirm' },
        { name: 'Cancel', value: 'cancel' },
        { name: 'List', value: 'list' },
      ],
      default: 'create',
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
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['customer'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Name',
      name: 'name',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['customer'],
          operation: ['create', 'update'],
        },
      },
    },
    {
      displayName: 'Amount',
      name: 'amount',
      type: 'number',
      default: 0,
      description: 'Amount in cents',
      displayOptions: {
        show: {
          resource: ['paymentIntent', 'charge'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Currency',
      name: 'currency',
      type: 'string',
      default: 'usd',
      displayOptions: {
        show: {
          resource: ['paymentIntent', 'charge'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Payment Intent ID',
      name: 'paymentIntentId',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['paymentIntent'],
          operation: ['get', 'confirm', 'cancel'],
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
          displayName: 'Description',
          name: 'description',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Metadata',
          name: 'metadata',
          type: 'json',
          default: '{}',
        },
        {
          displayName: 'Limit',
          name: 'limit',
          type: 'number',
          default: 10,
        },
        {
          displayName: 'Starting After',
          name: 'starting_after',
          type: 'string',
          default: '',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('stripeApi');
    const baseUrl = 'https://api.stripe.com/v1';

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      const headers = {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      try {
        let responseData: any;

        if (resource === 'customer') {
          if (operation === 'create') {
            const email = this.getNodeParameter('email', i) as string;
            const name = this.getNodeParameter('name', i) as string;

            const body = new URLSearchParams();
            if (email) body.append('email', email);
            if (name) body.append('name', name);
            if (options.description) body.append('description', options.description);

            if (options.metadata) {
              try {
                const metadata = JSON.parse(options.metadata);
                Object.entries(metadata).forEach(([key, value]) => {
                  body.append(`metadata[${key}]`, String(value));
                });
              } catch {}
            }

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/customers`,
              headers,
              body: body.toString(),
              json: true,
            });
          } else if (operation === 'get') {
            const customerId = this.getNodeParameter('customerId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/customers/${customerId}`,
              headers,
              json: true,
            });
          } else if (operation === 'list') {
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.starting_after) qs.starting_after = options.starting_after;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/customers`,
              headers,
              qs,
              json: true,
            });

            if (responseData.data) {
              for (const customer of responseData.data) {
                returnData.push({
                  json: customer,
                  pairedItem: { item: i },
                });
              }
              continue;
            }
          } else if (operation === 'delete') {
            const customerId = this.getNodeParameter('customerId', i) as string;

            responseData = await this.helpers.request({
              method: 'DELETE',
              url: `${baseUrl}/customers/${customerId}`,
              headers,
              json: true,
            });
          }
        } else if (resource === 'paymentIntent') {
          if (operation === 'create') {
            const amount = this.getNodeParameter('amount', i) as number;
            const currency = this.getNodeParameter('currency', i) as string;

            const body = new URLSearchParams();
            body.append('amount', String(amount));
            body.append('currency', currency);

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/payment_intents`,
              headers,
              body: body.toString(),
              json: true,
            });
          } else if (operation === 'get') {
            const paymentIntentId = this.getNodeParameter('paymentIntentId', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/payment_intents/${paymentIntentId}`,
              headers,
              json: true,
            });
          } else if (operation === 'confirm') {
            const paymentIntentId = this.getNodeParameter('paymentIntentId', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/payment_intents/${paymentIntentId}/confirm`,
              headers,
              json: true,
            });
          } else if (operation === 'cancel') {
            const paymentIntentId = this.getNodeParameter('paymentIntentId', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/payment_intents/${paymentIntentId}/cancel`,
              headers,
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

import { createCredentialType } from '@agentsmith/shared';

export const ShopifyApi = createCredentialType({
  name: 'shopifyApi',
  displayName: 'Shopify API',
  documentationUrl: 'https://shopify.dev/docs/api',
  properties: [
    {
      displayName: 'Shop Name',
      name: 'shopName',
      type: 'string',
      default: '',
      placeholder: 'myshop',
      description: 'The name of your Shopify store (e.g., for myshop.myshopify.com, enter "myshop")',
      required: true,
    },
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'API Version',
      name: 'apiVersion',
      type: 'string',
      default: '2024-01',
      description: 'The API version to use',
    },
  ],
  authenticate: {
    type: 'header',
    header: {
      name: 'X-Shopify-Access-Token',
      valueField: 'accessToken',
    },
  },
});

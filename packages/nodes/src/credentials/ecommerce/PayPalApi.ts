import { createCredentialType } from '@agentsmith/shared';

export const PayPalApi = createCredentialType({
  name: 'paypalApi',
  displayName: 'PayPal API',
  documentationUrl: 'https://developer.paypal.com/docs/api/overview/',
  properties: [
    {
      displayName: 'Environment',
      name: 'environment',
      type: 'options',
      options: [
        { name: 'Sandbox', value: 'sandbox' },
        { name: 'Live', value: 'live' },
      ],
      default: 'sandbox',
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
});

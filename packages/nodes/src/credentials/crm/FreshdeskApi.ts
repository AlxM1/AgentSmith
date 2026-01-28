import { createCredentialType } from '@agentsmith/shared';

export const FreshdeskApi = createCredentialType({
  name: 'freshdeskApi',
  displayName: 'Freshdesk API',
  documentationUrl: 'https://developers.freshdesk.com/api/',
  properties: [
    {
      displayName: 'Domain',
      name: 'domain',
      type: 'string',
      default: '',
      placeholder: 'yourcompany.freshdesk.com',
      required: true,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'basicAuth',
    basicAuth: {
      usernameField: 'apiKey',
      passwordField: '',
      passwordValue: 'X',
    },
  },
});

import { createCredentialType } from '@agentsmith/shared';

export const ZendeskApi = createCredentialType({
  name: 'zendeskApi',
  displayName: 'Zendesk API',
  documentationUrl: 'https://developer.zendesk.com/api-reference/',
  properties: [
    {
      displayName: 'Subdomain',
      name: 'subdomain',
      type: 'string',
      default: '',
      placeholder: 'yourcompany',
      description: 'The subdomain of your Zendesk account',
      required: true,
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'basicAuth',
    basicAuth: {
      usernameField: 'email',
      usernamePostfix: '/token',
      passwordField: 'apiToken',
    },
  },
});

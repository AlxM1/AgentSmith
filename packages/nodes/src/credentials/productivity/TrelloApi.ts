import { createCredentialType } from '@agentsmith/shared';

export const TrelloApi = createCredentialType({
  name: 'trelloApi',
  displayName: 'Trello API',
  documentationUrl: 'https://developer.atlassian.com/cloud/trello/',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
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
    type: 'custom',
    custom: {
      qs: {
        key: '={{$credentials.apiKey}}',
        token: '={{$credentials.apiToken}}',
      },
    },
  },
});

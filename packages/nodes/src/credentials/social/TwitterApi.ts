import { createCredentialType } from '@agentsmith/shared';

export const TwitterApi = createCredentialType({
  name: 'twitterApi',
  displayName: 'Twitter API',
  documentationUrl: 'https://developer.twitter.com/en/docs',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'API Key Secret',
      name: 'apiKeySecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Access Token Secret',
      name: 'accessTokenSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Bearer Token',
      name: 'bearerToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Required for v2 API endpoints',
    },
  ],
});

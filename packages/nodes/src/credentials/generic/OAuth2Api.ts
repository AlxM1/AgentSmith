import { createCredentialType } from '@agentsmith/shared';

export const OAuth2Api = createCredentialType({
  name: 'oAuth2Api',
  displayName: 'OAuth2 API',
  documentationUrl: 'https://oauth.net/2/',
  properties: [
    {
      displayName: 'Grant Type',
      name: 'grantType',
      type: 'options',
      options: [
        { name: 'Authorization Code', value: 'authorizationCode' },
        { name: 'Client Credentials', value: 'clientCredentials' },
        { name: 'PKCE', value: 'pkce' },
      ],
      default: 'authorizationCode',
    },
    {
      displayName: 'Authorization URL',
      name: 'authUrl',
      type: 'string',
      default: '',
      required: true,
      displayOptions: {
        show: {
          grantType: ['authorizationCode', 'pkce'],
        },
      },
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'string',
      default: '',
      required: true,
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
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Auth URI Query Parameters',
      name: 'authQueryParameters',
      type: 'string',
      default: '',
      placeholder: 'access_type=offline',
    },
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'options',
      options: [
        { name: 'Body', value: 'body' },
        { name: 'Header', value: 'header' },
      ],
      default: 'header',
      description: 'How to send client credentials',
    },
  ],
  authenticate: {
    type: 'oauth2',
  },
});

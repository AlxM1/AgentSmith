import { createCredentialType } from '@agentsmith/shared';

export const BitbucketApi = createCredentialType({
  name: 'bitbucketApi',
  displayName: 'Bitbucket API',
  documentationUrl: 'https://developer.atlassian.com/cloud/bitbucket/rest/intro/',
  properties: [
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'App Password',
      name: 'appPassword',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'basicAuth',
    basicAuth: {
      usernameField: 'username',
      passwordField: 'appPassword',
    },
  },
  testRequest: {
    url: 'https://api.bitbucket.org/2.0/user',
  },
});

import { createCredentialType } from '@agentsmith/shared';

export const HttpQueryAuth = createCredentialType({
  name: 'httpQueryAuth',
  displayName: 'HTTP Query Auth',
  documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication',
  properties: [
    {
      displayName: 'Query Parameter Name',
      name: 'name',
      type: 'string',
      default: '',
      placeholder: 'api_key',
      required: true,
    },
    {
      displayName: 'Value',
      name: 'value',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'query',
    query: {
      nameField: 'name',
      valueField: 'value',
    },
  },
});

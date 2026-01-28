import { createCredentialType } from '@agentsmith/shared';

export const HttpHeaderAuth = createCredentialType({
  name: 'httpHeaderAuth',
  displayName: 'HTTP Header Auth',
  documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers',
  properties: [
    {
      displayName: 'Header Name',
      name: 'name',
      type: 'string',
      default: '',
      placeholder: 'X-API-Key',
      required: true,
    },
    {
      displayName: 'Header Value',
      name: 'value',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'header',
    header: {
      nameField: 'name',
      valueField: 'value',
    },
  },
});

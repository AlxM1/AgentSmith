import { createCredentialType } from '@agentsmith/shared';

export const MixpanelApi = createCredentialType({
  name: 'mixpanelApi',
  displayName: 'Mixpanel API',
  documentationUrl: 'https://developer.mixpanel.com/reference/overview',
  properties: [
    {
      displayName: 'Project Token',
      name: 'projectToken',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'API Secret',
      name: 'apiSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Data Residency',
      name: 'dataResidency',
      type: 'options',
      options: [
        { name: 'US', value: 'us' },
        { name: 'EU', value: 'eu' },
      ],
      default: 'us',
    },
  ],
});

import { createCredentialType } from '@agentsmith/shared';

export const AmplitudeApi = createCredentialType({
  name: 'amplitudeApi',
  displayName: 'Amplitude API',
  documentationUrl: 'https://www.docs.developers.amplitude.com/',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Secret Key',
      name: 'secretKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Data Center',
      name: 'dataCenter',
      type: 'options',
      options: [
        { name: 'US', value: 'us' },
        { name: 'EU', value: 'eu' },
      ],
      default: 'us',
    },
  ],
});

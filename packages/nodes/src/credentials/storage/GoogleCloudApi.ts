import { createCredentialType } from '@agentsmith/shared';

export const GoogleCloudApi = createCredentialType({
  name: 'googleCloudApi',
  displayName: 'Google Cloud API',
  documentationUrl: 'https://cloud.google.com/docs/authentication',
  properties: [
    {
      displayName: 'Service Account Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: { password: true, rows: 5 },
      default: '',
      description: 'The private key from your service account JSON',
      required: true,
    },
    {
      displayName: 'Project ID',
      name: 'projectId',
      type: 'string',
      default: '',
      required: true,
    },
  ],
});

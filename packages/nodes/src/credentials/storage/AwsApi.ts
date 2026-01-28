import { createCredentialType } from '@agentsmith/shared';

export const AwsApi = createCredentialType({
  name: 'awsApi',
  displayName: 'AWS API',
  documentationUrl: 'https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html',
  properties: [
    {
      displayName: 'Region',
      name: 'region',
      type: 'string',
      default: 'us-east-1',
      required: true,
    },
    {
      displayName: 'Access Key ID',
      name: 'accessKeyId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Secret Access Key',
      name: 'secretAccessKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Session Token (Optional)',
      name: 'sessionToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: false,
    },
  ],
});

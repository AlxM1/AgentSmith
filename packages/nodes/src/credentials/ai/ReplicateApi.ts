import { createApiKeyCredential } from '@agentsmith/shared';

export const ReplicateApi = createApiKeyCredential({
  name: 'replicateApi',
  displayName: 'Replicate API',
  documentationUrl: 'https://replicate.com/docs/reference/http',
  headerName: 'Authorization',
  headerPrefix: 'Token ',
});

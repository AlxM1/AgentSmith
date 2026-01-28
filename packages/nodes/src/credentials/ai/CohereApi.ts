import { createApiKeyCredential } from '@agentsmith/shared';

export const CohereApi = createApiKeyCredential({
  name: 'cohereApi',
  displayName: 'Cohere API',
  documentationUrl: 'https://docs.cohere.com/',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

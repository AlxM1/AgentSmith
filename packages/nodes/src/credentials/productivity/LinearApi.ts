import { createApiKeyCredential } from '@agentsmith/shared';

export const LinearApi = createApiKeyCredential({
  name: 'linearApi',
  displayName: 'Linear API',
  documentationUrl: 'https://developers.linear.app/docs',
  headerName: 'Authorization',
  headerPrefix: '',
  testUrl: 'https://api.linear.app/graphql',
});

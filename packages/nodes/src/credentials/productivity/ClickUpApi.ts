import { createApiKeyCredential } from '@agentsmith/shared';

export const ClickUpApi = createApiKeyCredential({
  name: 'clickUpApi',
  displayName: 'ClickUp API',
  documentationUrl: 'https://clickup.com/api',
  headerName: 'Authorization',
  headerPrefix: '',
  testUrl: 'https://api.clickup.com/api/v2/user',
});

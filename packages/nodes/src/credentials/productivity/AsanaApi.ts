import { createApiKeyCredential } from '@agentsmith/shared';

export const AsanaApi = createApiKeyCredential({
  name: 'asanaApi',
  displayName: 'Asana API',
  documentationUrl: 'https://developers.asana.com/docs',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://app.asana.com/api/1.0/users/me',
});

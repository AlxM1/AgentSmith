import { createApiKeyCredential } from '@agentsmith/shared';

export const MondayApi = createApiKeyCredential({
  name: 'mondayApi',
  displayName: 'Monday.com API',
  documentationUrl: 'https://developer.monday.com/api-reference',
  headerName: 'Authorization',
  headerPrefix: '',
});

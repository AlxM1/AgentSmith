import { createApiKeyCredential } from '@agentsmith/shared';

export const NotionApi = createApiKeyCredential({
  name: 'notionApi',
  displayName: 'Notion API',
  documentationUrl: 'https://developers.notion.com/',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.notion.com/v1/users/me',
});

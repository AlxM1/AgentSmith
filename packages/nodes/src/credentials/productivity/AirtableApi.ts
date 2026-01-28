import { createApiKeyCredential } from '@agentsmith/shared';

export const AirtableApi = createApiKeyCredential({
  name: 'airtableApi',
  displayName: 'Airtable API',
  documentationUrl: 'https://airtable.com/developers/web/api',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.airtable.com/v0/meta/whoami',
});

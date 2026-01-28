import { createApiKeyCredential } from '@agentsmith/shared';

export const HubspotApi = createApiKeyCredential({
  name: 'hubspotApi',
  displayName: 'HubSpot API',
  documentationUrl: 'https://developers.hubspot.com/docs/api/overview',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
});

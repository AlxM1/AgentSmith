import { createApiKeyCredential } from '@agentsmith/shared';

export const IntercomApi = createApiKeyCredential({
  name: 'intercomApi',
  displayName: 'Intercom API',
  documentationUrl: 'https://developers.intercom.com/docs',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.intercom.io/me',
});

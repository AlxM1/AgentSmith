import { createApiKeyCredential } from '@agentsmith/shared';

export const NetlifyApi = createApiKeyCredential({
  name: 'netlifyApi',
  displayName: 'Netlify API',
  documentationUrl: 'https://docs.netlify.com/api/get-started/',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.netlify.com/api/v1/user',
});

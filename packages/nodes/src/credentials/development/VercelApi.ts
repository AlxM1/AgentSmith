import { createApiKeyCredential } from '@agentsmith/shared';

export const VercelApi = createApiKeyCredential({
  name: 'vercelApi',
  displayName: 'Vercel API',
  documentationUrl: 'https://vercel.com/docs/rest-api',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.vercel.com/v2/user',
});

import { createApiKeyCredential } from '@agentsmith/shared';

export const SendGridApi = createApiKeyCredential({
  name: 'sendGridApi',
  displayName: 'SendGrid API',
  documentationUrl: 'https://docs.sendgrid.com/api-reference',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

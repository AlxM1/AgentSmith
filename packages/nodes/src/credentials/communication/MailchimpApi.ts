import { createApiKeyCredential } from '@agentsmith/shared';

export const MailchimpApi = createApiKeyCredential({
  name: 'mailchimpApi',
  displayName: 'Mailchimp API',
  documentationUrl: 'https://mailchimp.com/developer/',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

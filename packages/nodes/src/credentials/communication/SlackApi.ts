import { createApiKeyCredential } from '@agentsmith/shared';

export const SlackApi = createApiKeyCredential({
  name: 'slackApi',
  displayName: 'Slack API',
  documentationUrl: 'https://api.slack.com/docs',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://slack.com/api/auth.test',
});

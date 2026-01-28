import { createApiKeyCredential } from '@agentsmith/shared';

export const GitlabApi = createApiKeyCredential({
  name: 'gitlabApi',
  displayName: 'GitLab API',
  documentationUrl: 'https://docs.gitlab.com/ee/api/',
  headerName: 'PRIVATE-TOKEN',
  headerPrefix: '',
  testUrl: 'https://gitlab.com/api/v4/user',
});

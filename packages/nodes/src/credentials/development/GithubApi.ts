import { createApiKeyCredential } from '@agentsmith/shared';

export const GithubApi = createApiKeyCredential({
  name: 'githubApi',
  displayName: 'GitHub API',
  documentationUrl: 'https://docs.github.com/en/rest',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.github.com/user',
});

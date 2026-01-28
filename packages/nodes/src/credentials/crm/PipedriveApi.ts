import { createApiKeyCredential } from '@agentsmith/shared';

export const PipedriveApi = createApiKeyCredential({
  name: 'pipedriveApi',
  displayName: 'Pipedrive API',
  documentationUrl: 'https://developers.pipedrive.com/docs/api/v1',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.pipedrive.com/v1/users/me',
});

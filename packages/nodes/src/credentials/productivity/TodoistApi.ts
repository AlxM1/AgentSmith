import { createApiKeyCredential } from '@agentsmith/shared';

export const TodoistApi = createApiKeyCredential({
  name: 'todoistApi',
  displayName: 'Todoist API',
  documentationUrl: 'https://developer.todoist.com/rest/v2',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

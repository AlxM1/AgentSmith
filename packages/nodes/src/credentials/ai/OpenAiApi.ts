import { createApiKeyCredential } from '@agentsmith/shared';

export const OpenAiApi = createApiKeyCredential({
  name: 'openAiApi',
  displayName: 'OpenAI API',
  documentationUrl: 'https://platform.openai.com/docs/api-reference',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.openai.com/v1/models',
});

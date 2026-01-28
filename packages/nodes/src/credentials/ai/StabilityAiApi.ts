import { createApiKeyCredential } from '@agentsmith/shared';

export const StabilityAiApi = createApiKeyCredential({
  name: 'stabilityAiApi',
  displayName: 'Stability AI API',
  documentationUrl: 'https://platform.stability.ai/docs',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

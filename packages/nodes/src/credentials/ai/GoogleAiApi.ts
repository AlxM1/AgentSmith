import { createApiKeyCredential } from '@agentsmith/shared';

export const GoogleAiApi = createApiKeyCredential({
  name: 'googleAiApi',
  displayName: 'Google AI (Gemini) API',
  documentationUrl: 'https://ai.google.dev/docs',
  headerName: 'x-goog-api-key',
  headerPrefix: '',
});

import { createApiKeyCredential } from '@agentsmith/shared';

export const AnthropicApi = createApiKeyCredential({
  name: 'anthropicApi',
  displayName: 'Anthropic API',
  documentationUrl: 'https://docs.anthropic.com/claude/reference',
  headerName: 'x-api-key',
  headerPrefix: '',
  testUrl: 'https://api.anthropic.com/v1/messages',
});

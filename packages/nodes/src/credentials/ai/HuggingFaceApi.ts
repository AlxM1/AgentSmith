import { createApiKeyCredential } from '@agentsmith/shared';

export const HuggingFaceApi = createApiKeyCredential({
  name: 'huggingFaceApi',
  displayName: 'Hugging Face API',
  documentationUrl: 'https://huggingface.co/docs/api-inference',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
});

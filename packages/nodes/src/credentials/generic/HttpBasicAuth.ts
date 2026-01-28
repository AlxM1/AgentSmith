import { createBasicAuthCredential } from '@agentsmith/shared';

export const HttpBasicAuth = createBasicAuthCredential({
  name: 'httpBasicAuth',
  displayName: 'HTTP Basic Auth',
  documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication',
});

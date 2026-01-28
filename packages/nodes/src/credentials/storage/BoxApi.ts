import { createOAuth2Credential } from '@agentsmith/shared';

export const BoxApi = createOAuth2Credential({
  name: 'boxApi',
  displayName: 'Box API',
  documentationUrl: 'https://developer.box.com/reference/',
  authorizationUrl: 'https://account.box.com/api/oauth2/authorize',
  accessTokenUrl: 'https://api.box.com/oauth2/token',
  scope: [],
});

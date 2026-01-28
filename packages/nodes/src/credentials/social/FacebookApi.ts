import { createOAuth2Credential } from '@agentsmith/shared';

export const FacebookApi = createOAuth2Credential({
  name: 'facebookApi',
  displayName: 'Facebook API',
  documentationUrl: 'https://developers.facebook.com/docs/',
  authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
  accessTokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
  scope: ['email', 'public_profile', 'pages_manage_posts', 'pages_read_engagement'],
});

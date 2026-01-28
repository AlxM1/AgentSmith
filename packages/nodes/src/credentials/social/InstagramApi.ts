import { createOAuth2Credential } from '@agentsmith/shared';

export const InstagramApi = createOAuth2Credential({
  name: 'instagramApi',
  displayName: 'Instagram API',
  documentationUrl: 'https://developers.facebook.com/docs/instagram-api/',
  authorizationUrl: 'https://api.instagram.com/oauth/authorize',
  accessTokenUrl: 'https://api.instagram.com/oauth/access_token',
  scope: ['user_profile', 'user_media'],
});

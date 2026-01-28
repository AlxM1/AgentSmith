import { createOAuth2Credential } from '@agentsmith/shared';

export const LinkedInApi = createOAuth2Credential({
  name: 'linkedInApi',
  displayName: 'LinkedIn API',
  documentationUrl: 'https://docs.microsoft.com/en-us/linkedin/',
  authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  accessTokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  scope: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
});

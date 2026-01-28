import { createOAuth2Credential } from '@agentsmith/shared';

export const GoogleAnalyticsApi = createOAuth2Credential({
  name: 'googleAnalyticsApi',
  displayName: 'Google Analytics API',
  documentationUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  accessTokenUrl: 'https://oauth2.googleapis.com/token',
  scope: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/analytics',
  ],
});

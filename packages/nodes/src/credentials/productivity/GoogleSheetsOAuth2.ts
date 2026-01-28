import { createOAuth2Credential } from '@agentsmith/shared';

export const GoogleSheetsOAuth2 = createOAuth2Credential({
  name: 'googleSheetsOAuth2',
  displayName: 'Google Sheets OAuth2',
  documentationUrl: 'https://developers.google.com/sheets/api',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  accessTokenUrl: 'https://oauth2.googleapis.com/token',
  scope: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ],
});

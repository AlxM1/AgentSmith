import { createOAuth2Credential } from '@agentsmith/shared';

export const DropboxApi = createOAuth2Credential({
  name: 'dropboxApi',
  displayName: 'Dropbox API',
  documentationUrl: 'https://www.dropbox.com/developers/documentation',
  authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
  accessTokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  scope: ['files.content.read', 'files.content.write', 'files.metadata.read', 'files.metadata.write'],
});

import { createApiKeyCredential } from '@agentsmith/shared';

export const DiscordApi = createApiKeyCredential({
  name: 'discordApi',
  displayName: 'Discord API',
  documentationUrl: 'https://discord.com/developers/docs',
  headerName: 'Authorization',
  headerPrefix: 'Bot ',
});

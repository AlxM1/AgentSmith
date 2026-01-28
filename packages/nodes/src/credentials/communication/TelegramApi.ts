import { createCredentialType } from '@agentsmith/shared';

export const TelegramApi = createCredentialType({
  name: 'telegramApi',
  displayName: 'Telegram API',
  documentationUrl: 'https://core.telegram.org/bots/api',
  properties: [
    {
      displayName: 'Bot Token',
      name: 'botToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'The token from @BotFather',
    },
  ],
});

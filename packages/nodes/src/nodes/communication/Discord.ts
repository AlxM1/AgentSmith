import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Discord = createProgrammaticNode({
  name: 'discord',
  displayName: 'Discord',
  description: 'Send messages to Discord via webhooks',
  icon: 'file:discord.svg',
  group: ['output'],
  version: 1,
  defaults: {
    name: 'Discord',
  },
  credentials: [
    { name: 'discordApi', required: false },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Send Webhook Message', value: 'sendWebhook' },
        { name: 'Send Bot Message', value: 'sendMessage' },
      ],
      default: 'sendWebhook',
    },
    {
      displayName: 'Webhook URL',
      name: 'webhookUrl',
      type: 'string',
      default: '',
      required: true,
      displayOptions: {
        show: {
          operation: ['sendWebhook'],
        },
      },
    },
    {
      displayName: 'Channel ID',
      name: 'channelId',
      type: 'string',
      default: '',
      required: true,
      displayOptions: {
        show: {
          operation: ['sendMessage'],
        },
      },
    },
    {
      displayName: 'Content',
      name: 'content',
      type: 'string',
      typeOptions: {
        rows: 3,
      },
      default: '',
      description: 'Message content (up to 2000 characters)',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Username',
          name: 'username',
          type: 'string',
          default: '',
          description: 'Override the default username of the webhook',
        },
        {
          displayName: 'Avatar URL',
          name: 'avatar_url',
          type: 'string',
          default: '',
          description: 'Override the default avatar of the webhook',
        },
        {
          displayName: 'TTS',
          name: 'tts',
          type: 'boolean',
          default: false,
          description: 'Send as text-to-speech message',
        },
        {
          displayName: 'Embeds',
          name: 'embeds',
          type: 'json',
          default: '[]',
          description: 'Array of embed objects',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const content = this.getNodeParameter('content', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;

        if (operation === 'sendWebhook') {
          const webhookUrl = this.getNodeParameter('webhookUrl', i) as string;

          const body: Record<string, any> = { content };

          if (options.username) body.username = options.username;
          if (options.avatar_url) body.avatar_url = options.avatar_url;
          if (options.tts) body.tts = options.tts;

          if (options.embeds && typeof options.embeds === 'string') {
            try {
              body.embeds = JSON.parse(options.embeds);
            } catch {}
          }

          responseData = await this.helpers.request({
            method: 'POST',
            url: webhookUrl,
            headers: {
              'Content-Type': 'application/json',
            },
            body,
            json: true,
          });
        } else if (operation === 'sendMessage') {
          const channelId = this.getNodeParameter('channelId', i) as string;
          const credentials = await this.getCredentials('discordApi');

          const body: Record<string, any> = { content };

          if (options.tts) body.tts = options.tts;
          if (options.embeds && typeof options.embeds === 'string') {
            try {
              body.embeds = JSON.parse(options.embeds);
            } catch {}
          }

          responseData = await this.helpers.request({
            method: 'POST',
            url: `https://discord.com/api/v10/channels/${channelId}/messages`,
            headers: {
              'Authorization': `Bot ${credentials.botToken}`,
              'Content-Type': 'application/json',
            },
            body,
            json: true,
          });
        }

        returnData.push({
          json: responseData || { success: true },
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  },
});

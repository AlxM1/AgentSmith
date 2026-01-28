import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Telegram = createProgrammaticNode({
  name: 'telegram',
  displayName: 'Telegram',
  description: 'Send messages via Telegram Bot API',
  icon: 'file:telegram.svg',
  group: ['output'],
  version: 1,
  defaults: {
    name: 'Telegram',
  },
  credentials: [
    { name: 'telegramApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Message', value: 'message' },
        { name: 'Chat', value: 'chat' },
        { name: 'File', value: 'file' },
      ],
      default: 'message',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['message'],
        },
      },
      options: [
        { name: 'Send Text', value: 'sendMessage' },
        { name: 'Send Photo', value: 'sendPhoto' },
        { name: 'Send Document', value: 'sendDocument' },
        { name: 'Edit Message', value: 'editMessage' },
        { name: 'Delete Message', value: 'deleteMessage' },
      ],
      default: 'sendMessage',
    },
    {
      displayName: 'Chat ID',
      name: 'chatId',
      type: 'string',
      default: '',
      required: true,
      description: 'Unique identifier for the target chat',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: {
        rows: 3,
      },
      default: '',
      displayOptions: {
        show: {
          resource: ['message'],
          operation: ['sendMessage', 'editMessage'],
        },
      },
    },
    {
      displayName: 'Message ID',
      name: 'messageId',
      type: 'number',
      default: 0,
      displayOptions: {
        show: {
          operation: ['editMessage', 'deleteMessage'],
        },
      },
    },
    {
      displayName: 'Photo',
      name: 'photo',
      type: 'string',
      default: '',
      description: 'Photo URL or file_id',
      displayOptions: {
        show: {
          operation: ['sendPhoto'],
        },
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Parse Mode',
          name: 'parse_mode',
          type: 'options',
          options: [
            { name: 'None', value: '' },
            { name: 'HTML', value: 'HTML' },
            { name: 'Markdown', value: 'Markdown' },
            { name: 'MarkdownV2', value: 'MarkdownV2' },
          ],
          default: '',
        },
        {
          displayName: 'Disable Notification',
          name: 'disable_notification',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Disable Web Page Preview',
          name: 'disable_web_page_preview',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Reply to Message ID',
          name: 'reply_to_message_id',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Reply Markup',
          name: 'reply_markup',
          type: 'json',
          default: '{}',
          description: 'Inline keyboard or custom reply keyboard',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('telegramApi');
    const baseUrl = `https://api.telegram.org/bot${credentials.botToken}`;

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const chatId = this.getNodeParameter('chatId', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;

        if (resource === 'message') {
          if (operation === 'sendMessage') {
            const text = this.getNodeParameter('text', i) as string;

            const body: Record<string, any> = {
              chat_id: chatId,
              text,
              ...options,
            };

            if (options.reply_markup && typeof options.reply_markup === 'string') {
              try {
                body.reply_markup = JSON.parse(options.reply_markup);
              } catch {}
            }

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/sendMessage`,
              body,
              json: true,
            });
          } else if (operation === 'sendPhoto') {
            const photo = this.getNodeParameter('photo', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/sendPhoto`,
              body: {
                chat_id: chatId,
                photo,
                caption: options.caption,
                parse_mode: options.parse_mode,
              },
              json: true,
            });
          } else if (operation === 'editMessage') {
            const text = this.getNodeParameter('text', i) as string;
            const messageId = this.getNodeParameter('messageId', i) as number;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/editMessageText`,
              body: {
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: options.parse_mode,
              },
              json: true,
            });
          } else if (operation === 'deleteMessage') {
            const messageId = this.getNodeParameter('messageId', i) as number;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/deleteMessage`,
              body: {
                chat_id: chatId,
                message_id: messageId,
              },
              json: true,
            });
          }
        }

        returnData.push({
          json: responseData.result || responseData,
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

import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Slack = createProgrammaticNode({
  name: 'slack',
  displayName: 'Slack',
  description: 'Send messages and interact with Slack',
  icon: 'file:slack.svg',
  group: ['output'],
  version: 1,
  defaults: {
    name: 'Slack',
  },
  credentials: [
    { name: 'slackApi', required: true },
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
        { name: 'Channel', value: 'channel' },
        { name: 'User', value: 'user' },
        { name: 'Reaction', value: 'reaction' },
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
        { name: 'Send', value: 'post' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
        { name: 'Get Permalink', value: 'getPermalink' },
      ],
      default: 'post',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['channel'],
        },
      },
      options: [
        { name: 'Get', value: 'get' },
        { name: 'Get Many', value: 'getAll' },
        { name: 'Create', value: 'create' },
        { name: 'Archive', value: 'archive' },
        { name: 'Invite', value: 'invite' },
      ],
      default: 'get',
    },
    {
      displayName: 'Channel',
      name: 'channel',
      type: 'string',
      default: '',
      placeholder: '#general or C1234567890',
      required: true,
      displayOptions: {
        show: {
          resource: ['message'],
          operation: ['post', 'update', 'delete', 'getPermalink'],
        },
      },
    },
    {
      displayName: 'Message Text',
      name: 'text',
      type: 'string',
      typeOptions: {
        rows: 3,
      },
      default: '',
      displayOptions: {
        show: {
          resource: ['message'],
          operation: ['post', 'update'],
        },
      },
    },
    {
      displayName: 'Message Timestamp',
      name: 'ts',
      type: 'string',
      default: '',
      description: 'Timestamp of the message to update or delete',
      displayOptions: {
        show: {
          resource: ['message'],
          operation: ['update', 'delete', 'getPermalink'],
        },
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      displayOptions: {
        show: {
          resource: ['message'],
          operation: ['post'],
        },
      },
      options: [
        {
          displayName: 'Thread Timestamp',
          name: 'thread_ts',
          type: 'string',
          default: '',
          description: 'Reply in thread by providing parent message timestamp',
        },
        {
          displayName: 'Username',
          name: 'username',
          type: 'string',
          default: '',
          description: 'Custom username for the message',
        },
        {
          displayName: 'Icon Emoji',
          name: 'icon_emoji',
          type: 'string',
          default: '',
          placeholder: ':robot_face:',
        },
        {
          displayName: 'Icon URL',
          name: 'icon_url',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Link Names',
          name: 'link_names',
          type: 'boolean',
          default: true,
          description: 'Find and link channel names and usernames',
        },
        {
          displayName: 'Unfurl Links',
          name: 'unfurl_links',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Unfurl Media',
          name: 'unfurl_media',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Blocks',
          name: 'blocks',
          type: 'json',
          default: '[]',
          description: 'Slack Block Kit blocks',
        },
        {
          displayName: 'Attachments',
          name: 'attachments',
          type: 'json',
          default: '[]',
          description: 'Legacy attachments',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('slackApi');

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      try {
        let responseData: any;

        if (resource === 'message') {
          const channel = this.getNodeParameter('channel', i) as string;

          if (operation === 'post') {
            const text = this.getNodeParameter('text', i) as string;
            const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

            const body: Record<string, any> = {
              channel,
              text,
              ...options,
            };

            // Parse JSON fields
            if (options.blocks && typeof options.blocks === 'string') {
              try {
                body.blocks = JSON.parse(options.blocks);
              } catch {}
            }
            if (options.attachments && typeof options.attachments === 'string') {
              try {
                body.attachments = JSON.parse(options.attachments);
              } catch {}
            }

            responseData = await this.helpers.request({
              method: 'POST',
              url: 'https://slack.com/api/chat.postMessage',
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
              },
              body,
              json: true,
            });
          } else if (operation === 'update') {
            const text = this.getNodeParameter('text', i) as string;
            const ts = this.getNodeParameter('ts', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: 'https://slack.com/api/chat.update',
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: { channel, text, ts },
              json: true,
            });
          } else if (operation === 'delete') {
            const ts = this.getNodeParameter('ts', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: 'https://slack.com/api/chat.delete',
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: { channel, ts },
              json: true,
            });
          } else if (operation === 'getPermalink') {
            const ts = this.getNodeParameter('ts', i) as string;

            responseData = await this.helpers.request({
              method: 'GET',
              url: `https://slack.com/api/chat.getPermalink?channel=${channel}&message_ts=${ts}`,
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
              },
              json: true,
            });
          }
        } else if (resource === 'channel') {
          if (operation === 'getAll') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: 'https://slack.com/api/conversations.list',
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
              },
              json: true,
            });
            responseData = responseData.channels;
          }
        }

        if (Array.isArray(responseData)) {
          returnData.push(...responseData.map(item => ({ json: item, pairedItem: { item: i } })));
        } else {
          returnData.push({ json: responseData, pairedItem: { item: i } });
        }
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

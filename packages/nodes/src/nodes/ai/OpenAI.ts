import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const OpenAI = createProgrammaticNode({
  name: 'openAi',
  displayName: 'OpenAI',
  description: 'Interact with OpenAI API',
  icon: 'file:openai.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'OpenAI',
  },
  credentials: [
    { name: 'openAiApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Chat', value: 'chat' },
        { name: 'Text', value: 'text' },
        { name: 'Image', value: 'image' },
        { name: 'Audio', value: 'audio' },
        { name: 'Embedding', value: 'embedding' },
      ],
      default: 'chat',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['chat'],
        },
      },
      options: [
        { name: 'Complete', value: 'complete' },
      ],
      default: 'complete',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['image'],
        },
      },
      options: [
        { name: 'Generate', value: 'generate' },
        { name: 'Edit', value: 'edit' },
        { name: 'Variation', value: 'variation' },
      ],
      default: 'generate',
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        { name: 'O1', value: 'o1' },
        { name: 'O1 Mini', value: 'o1-mini' },
      ],
      default: 'gpt-4o-mini',
      displayOptions: {
        show: {
          resource: ['chat', 'text'],
        },
      },
    },
    {
      displayName: 'Prompt',
      name: 'prompt',
      type: 'string',
      typeOptions: {
        rows: 4,
      },
      default: '',
      required: true,
    },
    {
      displayName: 'System Message',
      name: 'systemMessage',
      type: 'string',
      typeOptions: {
        rows: 2,
      },
      default: '',
      displayOptions: {
        show: {
          resource: ['chat'],
        },
      },
    },
    {
      displayName: 'Messages',
      name: 'messages',
      type: 'json',
      default: '[]',
      description: 'JSON array of messages for multi-turn conversations',
      displayOptions: {
        show: {
          resource: ['chat'],
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
          displayName: 'Temperature',
          name: 'temperature',
          type: 'number',
          typeOptions: {
            minValue: 0,
            maxValue: 2,
            numberPrecision: 1,
          },
          default: 0.7,
        },
        {
          displayName: 'Max Tokens',
          name: 'maxTokens',
          type: 'number',
          default: 1024,
        },
        {
          displayName: 'Top P',
          name: 'topP',
          type: 'number',
          typeOptions: {
            minValue: 0,
            maxValue: 1,
            numberPrecision: 2,
          },
          default: 1,
        },
        {
          displayName: 'Frequency Penalty',
          name: 'frequencyPenalty',
          type: 'number',
          typeOptions: {
            minValue: -2,
            maxValue: 2,
            numberPrecision: 1,
          },
          default: 0,
        },
        {
          displayName: 'Presence Penalty',
          name: 'presencePenalty',
          type: 'number',
          typeOptions: {
            minValue: -2,
            maxValue: 2,
            numberPrecision: 1,
          },
          default: 0,
        },
        {
          displayName: 'JSON Mode',
          name: 'jsonMode',
          type: 'boolean',
          default: false,
          description: 'Force the model to return valid JSON',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('openAiApi');

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const model = this.getNodeParameter('model', i) as string;
      const prompt = this.getNodeParameter('prompt', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        if (resource === 'chat') {
          const systemMessage = this.getNodeParameter('systemMessage', i) as string;
          const messagesJson = this.getNodeParameter('messages', i) as string;

          let messages: Array<{ role: string; content: string }> = [];

          // Add system message if provided
          if (systemMessage) {
            messages.push({ role: 'system', content: systemMessage });
          }

          // Add previous messages if provided
          try {
            const parsedMessages = JSON.parse(messagesJson);
            if (Array.isArray(parsedMessages)) {
              messages = [...messages, ...parsedMessages];
            }
          } catch {}

          // Add current prompt as user message
          messages.push({ role: 'user', content: prompt });

          const body: Record<string, any> = {
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1024,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
          };

          if (options.jsonMode) {
            body.response_format = { type: 'json_object' };
          }

          const response = await this.helpers.request({
            method: 'POST',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
              'Authorization': `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
            json: true,
          });

          returnData.push({
            json: {
              message: response.choices[0].message.content,
              role: response.choices[0].message.role,
              finishReason: response.choices[0].finish_reason,
              model: response.model,
              usage: response.usage,
              id: response.id,
            },
            pairedItem: { item: i },
          });
        } else if (resource === 'image') {
          const response = await this.helpers.request({
            method: 'POST',
            url: 'https://api.openai.com/v1/images/generations',
            headers: {
              'Authorization': `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: {
              model: 'dall-e-3',
              prompt,
              n: 1,
              size: '1024x1024',
            },
            json: true,
          });

          returnData.push({
            json: {
              url: response.data[0].url,
              revisedPrompt: response.data[0].revised_prompt,
            },
            pairedItem: { item: i },
          });
        } else if (resource === 'embedding') {
          const response = await this.helpers.request({
            method: 'POST',
            url: 'https://api.openai.com/v1/embeddings',
            headers: {
              'Authorization': `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: {
              model: 'text-embedding-3-small',
              input: prompt,
            },
            json: true,
          });

          returnData.push({
            json: {
              embedding: response.data[0].embedding,
              usage: response.usage,
            },
            pairedItem: { item: i },
          });
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

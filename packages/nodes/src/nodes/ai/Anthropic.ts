import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Anthropic = createProgrammaticNode({
  name: 'anthropic',
  displayName: 'Anthropic',
  description: 'Interact with Anthropic Claude API',
  icon: 'file:anthropic.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Anthropic',
  },
  credentials: [
    { name: 'anthropicApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
      ],
      default: 'claude-3-5-sonnet-20241022',
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
    },
    {
      displayName: 'Messages',
      name: 'messages',
      type: 'json',
      default: '[]',
      description: 'JSON array of messages for multi-turn conversations',
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
            maxValue: 1,
            numberPrecision: 2,
          },
          default: 1,
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
          displayName: 'Top K',
          name: 'topK',
          type: 'number',
          default: 0,
          description: 'Only sample from top K options',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('anthropicApi');

    for (let i = 0; i < items.length; i++) {
      const model = this.getNodeParameter('model', i) as string;
      const prompt = this.getNodeParameter('prompt', i) as string;
      const systemMessage = this.getNodeParameter('systemMessage', i) as string;
      const messagesJson = this.getNodeParameter('messages', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let messages: Array<{ role: string; content: string }> = [];

        // Add previous messages if provided
        try {
          const parsedMessages = JSON.parse(messagesJson);
          if (Array.isArray(parsedMessages)) {
            messages = [...parsedMessages];
          }
        } catch {}

        // Add current prompt as user message
        messages.push({ role: 'user', content: prompt });

        const body: Record<string, any> = {
          model,
          messages,
          max_tokens: options.maxTokens ?? 1024,
          temperature: options.temperature ?? 1,
          top_p: options.topP ?? 1,
        };

        if (systemMessage) {
          body.system = systemMessage;
        }

        if (options.topK && options.topK > 0) {
          body.top_k = options.topK;
        }

        const response = await this.helpers.request({
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'x-api-key': credentials.apiKey as string,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body,
          json: true,
        });

        returnData.push({
          json: {
            message: response.content[0].text,
            role: response.role,
            stopReason: response.stop_reason,
            model: response.model,
            usage: response.usage,
            id: response.id,
          },
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

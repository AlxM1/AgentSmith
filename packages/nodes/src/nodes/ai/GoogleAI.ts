import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const GoogleAI = createProgrammaticNode({
  name: 'googleAi',
  displayName: 'Google AI (Gemini)',
  description: 'Interact with Google Gemini API',
  icon: 'file:google.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Google AI',
  },
  credentials: [
    { name: 'googleAiApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash-exp' },
        { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
        { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        { name: 'Gemini 1.0 Pro', value: 'gemini-1.0-pro' },
      ],
      default: 'gemini-1.5-flash',
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
      displayName: 'System Instruction',
      name: 'systemInstruction',
      type: 'string',
      typeOptions: {
        rows: 2,
      },
      default: '',
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
            numberPrecision: 2,
          },
          default: 1,
        },
        {
          displayName: 'Max Output Tokens',
          name: 'maxOutputTokens',
          type: 'number',
          default: 2048,
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
          default: 0.95,
        },
        {
          displayName: 'Top K',
          name: 'topK',
          type: 'number',
          default: 40,
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('googleAiApi');

    for (let i = 0; i < items.length; i++) {
      const model = this.getNodeParameter('model', i) as string;
      const prompt = this.getNodeParameter('prompt', i) as string;
      const systemInstruction = this.getNodeParameter('systemInstruction', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        const body: Record<string, any> = {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            topP: options.topP ?? 0.95,
            topK: options.topK ?? 40,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        const response = await this.helpers.request({
          method: 'POST',
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${credentials.apiKey}`,
          headers: {
            'Content-Type': 'application/json',
          },
          body,
          json: true,
        });

        const candidate = response.candidates[0];
        returnData.push({
          json: {
            message: candidate.content.parts[0].text,
            finishReason: candidate.finishReason,
            safetyRatings: candidate.safetyRatings,
            usage: response.usageMetadata,
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

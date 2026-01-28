import { createProgrammaticNode } from '@agentsmith/shared';

export const OpenAIEmbeddings = createProgrammaticNode({
  name: 'OpenAIEmbeddings',
  displayName: 'OpenAI Embeddings',
  description: 'Generate embeddings using OpenAI models',
  icon: 'file:openai.svg',
  group: ['ai'],
  version: 1,
  defaults: { name: 'OpenAI Embeddings' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openAiApi', required: true }],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'text-embedding-3-small', value: 'text-embedding-3-small' },
        { name: 'text-embedding-3-large', value: 'text-embedding-3-large' },
        { name: 'text-embedding-ada-002', value: 'text-embedding-ada-002' },
      ],
      default: 'text-embedding-3-small',
    },
    {
      displayName: 'Input',
      name: 'input',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      description: 'Text to generate embedding for. Use expression for dynamic input.',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Dimensions',
          name: 'dimensions',
          type: 'number',
          default: 0,
          description: 'Number of dimensions (only for text-embedding-3 models). 0 = default',
        },
        {
          displayName: 'Encoding Format',
          name: 'encodingFormat',
          type: 'options',
          options: [
            { name: 'Float', value: 'float' },
            { name: 'Base64', value: 'base64' },
          ],
          default: 'float',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('openAiApi');
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const model = this.getNodeParameter('model', i) as string;
        const input = this.getNodeParameter('input', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        const body: any = { model, input };

        if (options.dimensions && model.includes('text-embedding-3')) {
          body.dimensions = options.dimensions;
        }
        if (options.encodingFormat) {
          body.encoding_format = options.encodingFormat;
        }

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();

        returnData.push({
          json: {
            embedding: data.data[0].embedding,
            model: data.model,
            usage: data.usage,
            dimensions: data.data[0].embedding.length,
          },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

export const OpenAIVision = createProgrammaticNode({
  name: 'OpenAIVision',
  displayName: 'OpenAI Vision',
  description: 'Analyze images using OpenAI GPT-4 Vision',
  icon: 'file:openai.svg',
  group: ['ai'],
  version: 1,
  defaults: { name: 'OpenAI Vision' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openAiApi', required: true }],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      ],
      default: 'gpt-4o',
    },
    {
      displayName: 'Image Source',
      name: 'imageSource',
      type: 'options',
      options: [
        { name: 'URL', value: 'url' },
        { name: 'Base64', value: 'base64' },
        { name: 'Binary Property', value: 'binary' },
      ],
      default: 'url',
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { imageSource: ['url'] } },
    },
    {
      displayName: 'Base64 Image',
      name: 'base64Image',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { imageSource: ['base64'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { imageSource: ['binary'] } },
    },
    {
      displayName: 'Prompt',
      name: 'prompt',
      type: 'string',
      typeOptions: { rows: 3 },
      default: 'What is in this image?',
      description: 'Question or instruction about the image',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Detail Level',
          name: 'detail',
          type: 'options',
          options: [
            { name: 'Auto', value: 'auto' },
            { name: 'Low', value: 'low' },
            { name: 'High', value: 'high' },
          ],
          default: 'auto',
        },
        {
          displayName: 'Max Tokens',
          name: 'maxTokens',
          type: 'number',
          default: 300,
        },
        {
          displayName: 'Temperature',
          name: 'temperature',
          type: 'number',
          default: 0.7,
          typeOptions: { minValue: 0, maxValue: 2 },
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('openAiApi');
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const model = this.getNodeParameter('model', i) as string;
        const imageSource = this.getNodeParameter('imageSource', i) as string;
        const prompt = this.getNodeParameter('prompt', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        let imageContent: any;

        if (imageSource === 'url') {
          const imageUrl = this.getNodeParameter('imageUrl', i) as string;
          imageContent = {
            type: 'image_url',
            image_url: { url: imageUrl, detail: options.detail || 'auto' },
          };
        } else if (imageSource === 'base64') {
          const base64Image = this.getNodeParameter('base64Image', i) as string;
          imageContent = {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: options.detail || 'auto' },
          };
        } else {
          const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
          const binaryData = items[i].binary?.[binaryProperty];
          if (!binaryData) throw new Error(`No binary data found in property ${binaryProperty}`);

          const mimeType = binaryData.mimeType || 'image/jpeg';
          const base64 = binaryData.data;
          imageContent = {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: options.detail || 'auto' },
          };
        }

        const body = {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                imageContent,
              ],
            },
          ],
          max_tokens: options.maxTokens || 300,
          temperature: options.temperature ?? 0.7,
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();

        returnData.push({
          json: {
            response: data.choices[0].message.content,
            model: data.model,
            usage: data.usage,
            finishReason: data.choices[0].finish_reason,
          },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

export const OpenAIFunctionCalling = createProgrammaticNode({
  name: 'OpenAIFunctionCalling',
  displayName: 'OpenAI Function Calling',
  description: 'Use OpenAI function calling to extract structured data',
  icon: 'file:openai.svg',
  group: ['ai'],
  version: 1,
  defaults: { name: 'OpenAI Function Calling' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openAiApi', required: true }],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ],
      default: 'gpt-4o-mini',
    },
    {
      displayName: 'Input',
      name: 'input',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
    },
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'string',
      typeOptions: { rows: 3 },
      default: 'You are a helpful assistant that extracts structured information from text.',
    },
    {
      displayName: 'Functions',
      name: 'functions',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [
        {
          displayName: 'Function',
          name: 'function',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Description',
              name: 'description',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Parameters (JSON Schema)',
              name: 'parameters',
              type: 'json',
              default: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Tool Choice',
      name: 'toolChoice',
      type: 'options',
      options: [
        { name: 'Auto', value: 'auto' },
        { name: 'Required (Force Function Call)', value: 'required' },
        { name: 'None', value: 'none' },
      ],
      default: 'auto',
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
          default: 0,
          typeOptions: { minValue: 0, maxValue: 2 },
        },
        {
          displayName: 'Max Tokens',
          name: 'maxTokens',
          type: 'number',
          default: 1000,
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('openAiApi');
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const model = this.getNodeParameter('model', i) as string;
        const input = this.getNodeParameter('input', i) as string;
        const systemPrompt = this.getNodeParameter('systemPrompt', i) as string;
        const functionsData = this.getNodeParameter('functions', i) as any;
        const toolChoice = this.getNodeParameter('toolChoice', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        const tools = (functionsData.function || []).map((fn: any) => ({
          type: 'function',
          function: {
            name: fn.name,
            description: fn.description,
            parameters: JSON.parse(fn.parameters),
          },
        }));

        const body: any = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? toolChoice : undefined,
          temperature: options.temperature ?? 0,
          max_tokens: options.maxTokens || 1000,
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;

        const result: any = {
          content: message.content,
          model: data.model,
          usage: data.usage,
          finishReason: data.choices[0].finish_reason,
        };

        // Extract function call results
        if (message.tool_calls) {
          result.functionCalls = message.tool_calls.map((call: any) => ({
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments),
          }));

          // If there's only one function call, flatten the result
          if (result.functionCalls.length === 1) {
            result.extractedData = result.functionCalls[0].arguments;
          }
        }

        returnData.push({ json: result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

export const OpenAITextToSpeech = createProgrammaticNode({
  name: 'OpenAITextToSpeech',
  displayName: 'OpenAI Text to Speech',
  description: 'Convert text to speech using OpenAI TTS',
  icon: 'file:openai.svg',
  group: ['ai'],
  version: 1,
  defaults: { name: 'OpenAI TTS' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openAiApi', required: true }],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'TTS-1', value: 'tts-1' },
        { name: 'TTS-1 HD', value: 'tts-1-hd' },
      ],
      default: 'tts-1',
    },
    {
      displayName: 'Voice',
      name: 'voice',
      type: 'options',
      options: [
        { name: 'Alloy', value: 'alloy' },
        { name: 'Echo', value: 'echo' },
        { name: 'Fable', value: 'fable' },
        { name: 'Onyx', value: 'onyx' },
        { name: 'Nova', value: 'nova' },
        { name: 'Shimmer', value: 'shimmer' },
      ],
      default: 'alloy',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 5 },
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
          displayName: 'Response Format',
          name: 'responseFormat',
          type: 'options',
          options: [
            { name: 'MP3', value: 'mp3' },
            { name: 'Opus', value: 'opus' },
            { name: 'AAC', value: 'aac' },
            { name: 'FLAC', value: 'flac' },
            { name: 'WAV', value: 'wav' },
            { name: 'PCM', value: 'pcm' },
          ],
          default: 'mp3',
        },
        {
          displayName: 'Speed',
          name: 'speed',
          type: 'number',
          default: 1,
          typeOptions: { minValue: 0.25, maxValue: 4.0 },
          description: 'Speed of speech (0.25 to 4.0)',
        },
      ],
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'audio',
      description: 'Name of the binary property to store the audio',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('openAiApi');
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const model = this.getNodeParameter('model', i) as string;
        const voice = this.getNodeParameter('voice', i) as string;
        const text = this.getNodeParameter('text', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

        const body: any = {
          model,
          voice,
          input: text,
          response_format: options.responseFormat || 'mp3',
        };

        if (options.speed && options.speed !== 1) {
          body.speed = options.speed;
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        const mimeTypes: Record<string, string> = {
          mp3: 'audio/mpeg',
          opus: 'audio/opus',
          aac: 'audio/aac',
          flac: 'audio/flac',
          wav: 'audio/wav',
          pcm: 'audio/pcm',
        };

        returnData.push({
          json: {
            ...items[i].json,
            model,
            voice,
            format: options.responseFormat || 'mp3',
          },
          binary: {
            [binaryProperty]: {
              data: base64,
              mimeType: mimeTypes[options.responseFormat || 'mp3'],
              fileName: `speech.${options.responseFormat || 'mp3'}`,
            },
          },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

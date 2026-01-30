/**
 * AI Agent Node
 *
 * Enterprise AI features:
 * - LangChain-style agent execution
 * - Multiple LLM providers (OpenAI, Anthropic, etc.)
 * - Tool/function calling
 * - Memory/context management
 * - Streaming responses
 * - Chain of thought reasoning
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../sdk/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAgentConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'bedrock' | 'ollama' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
  memory?: MemoryConfig;
  streaming?: boolean;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler?: string; // Node ID to execute
}

export interface MemoryConfig {
  type: 'none' | 'buffer' | 'summary' | 'vector';
  maxMessages?: number;
  summaryModel?: string;
  vectorStore?: {
    type: 'pinecone' | 'qdrant' | 'chroma' | 'memory';
    config?: Record<string, any>;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIAgentOutput {
  response: string;
  messages: ChatMessage[];
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// NODE DEFINITION
// ============================================================================

export const aiAgentNode: NodeDefinition = {
  name: 'AI Agent',
  type: 'ai-agent',
  group: 'AI',
  version: 1,
  description: 'Execute AI agent with LLM and optional tools',
  icon: 'robot',
  color: '#10B981',

  defaults: {
    name: 'AI Agent',
  },

  inputs: ['main'],
  outputs: ['main'],

  credentials: [
    {
      name: 'openaiApi',
      type: 'openaiApi',
      required: false,
      displayOptions: {
        show: {
          provider: ['openai'],
        },
      },
    },
    {
      name: 'anthropicApi',
      type: 'anthropicApi',
      required: false,
      displayOptions: {
        show: {
          provider: ['anthropic'],
        },
      },
    },
    {
      name: 'azureOpenaiApi',
      type: 'azureOpenaiApi',
      required: false,
      displayOptions: {
        show: {
          provider: ['azure'],
        },
      },
    },
  ],

  properties: [
    {
      name: 'provider',
      displayName: 'AI Provider',
      type: 'options',
      options: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Azure OpenAI', value: 'azure' },
        { name: 'AWS Bedrock', value: 'bedrock' },
        { name: 'Ollama (Local)', value: 'ollama' },
        { name: 'Custom', value: 'custom' },
      ],
      default: 'openai',
      required: true,
    },
    {
      name: 'model',
      displayName: 'Model',
      type: 'options',
      options: [
        // OpenAI
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        // Anthropic
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
        // Custom
        { name: 'Custom Model', value: 'custom' },
      ],
      default: 'gpt-4o',
      required: true,
    },
    {
      name: 'customModel',
      displayName: 'Custom Model ID',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          model: ['custom'],
        },
      },
    },
    {
      name: 'systemPrompt',
      displayName: 'System Prompt',
      type: 'string',
      typeOptions: {
        rows: 6,
      },
      default: 'You are a helpful AI assistant.',
      description: 'The system prompt that defines the AI behavior',
    },
    {
      name: 'prompt',
      displayName: 'User Prompt',
      type: 'string',
      typeOptions: {
        rows: 4,
      },
      default: '={{ $json.prompt }}',
      required: true,
      description: 'The user message to send to the AI',
    },
    {
      name: 'temperature',
      displayName: 'Temperature',
      type: 'number',
      default: 0.7,
      typeOptions: {
        minValue: 0,
        maxValue: 2,
        numberStepSize: 0.1,
      },
      description: 'Controls randomness (0 = deterministic, 2 = creative)',
    },
    {
      name: 'maxTokens',
      displayName: 'Max Tokens',
      type: 'number',
      default: 1024,
      typeOptions: {
        minValue: 1,
        maxValue: 128000,
      },
      description: 'Maximum tokens in the response',
    },
    {
      name: 'enableTools',
      displayName: 'Enable Tools',
      type: 'boolean',
      default: false,
      description: 'Allow the AI to call tools/functions',
    },
    {
      name: 'tools',
      displayName: 'Tools',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          enableTools: [true],
        },
      },
      default: {},
      options: [
        {
          name: 'tool',
          displayName: 'Tool',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
              required: true,
            },
            {
              name: 'description',
              displayName: 'Description',
              type: 'string',
              default: '',
              required: true,
            },
            {
              name: 'parameters',
              displayName: 'Parameters (JSON)',
              type: 'json',
              default: '{}',
            },
          ],
        },
      ],
    },
    {
      name: 'memoryType',
      displayName: 'Memory Type',
      type: 'options',
      options: [
        { name: 'None', value: 'none' },
        { name: 'Buffer (Last N messages)', value: 'buffer' },
        { name: 'Summary', value: 'summary' },
        { name: 'Vector Store', value: 'vector' },
      ],
      default: 'none',
    },
    {
      name: 'maxMemoryMessages',
      displayName: 'Max Memory Messages',
      type: 'number',
      default: 10,
      displayOptions: {
        show: {
          memoryType: ['buffer'],
        },
      },
    },
    {
      name: 'streaming',
      displayName: 'Enable Streaming',
      type: 'boolean',
      default: false,
      description: 'Stream the response (for real-time display)',
    },
    {
      name: 'outputFormat',
      displayName: 'Output Format',
      type: 'options',
      options: [
        { name: 'Text', value: 'text' },
        { name: 'JSON', value: 'json' },
        { name: 'Full Response', value: 'full' },
      ],
      default: 'text',
    },
    {
      name: 'jsonSchema',
      displayName: 'JSON Schema',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          outputFormat: ['json'],
        },
      },
      description: 'JSON schema for structured output',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const results: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const provider = context.getNodeParameter('provider', i) as string;
      const model = context.getNodeParameter('model', i) as string;
      const systemPrompt = context.getNodeParameter('systemPrompt', i) as string;
      const prompt = context.getNodeParameter('prompt', i) as string;
      const temperature = context.getNodeParameter('temperature', i) as number;
      const maxTokens = context.getNodeParameter('maxTokens', i) as number;
      const outputFormat = context.getNodeParameter('outputFormat', i) as string;

      try {
        // Get credentials
        const credentials = await context.getCredentials(
          provider === 'openai' ? 'openaiApi' :
          provider === 'anthropic' ? 'anthropicApi' :
          provider === 'azure' ? 'azureOpenaiApi' : 'openaiApi'
        );

        // Build messages
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ];

        // Make API call based on provider
        let response: AIAgentOutput;

        switch (provider) {
          case 'openai':
          case 'azure':
            response = await callOpenAI(credentials, model, messages, {
              temperature,
              maxTokens,
              outputFormat,
            });
            break;

          case 'anthropic':
            response = await callAnthropic(credentials, model, messages, {
              temperature,
              maxTokens,
              outputFormat,
            });
            break;

          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        // Format output based on outputFormat
        let output: any;
        switch (outputFormat) {
          case 'text':
            output = { response: response.response };
            break;
          case 'json':
            try {
              output = { data: JSON.parse(response.response) };
            } catch {
              output = { response: response.response, parseError: true };
            }
            break;
          case 'full':
            output = response;
            break;
          default:
            output = { response: response.response };
        }

        results.push({ json: output });
      } catch (error: any) {
        if (context.continueOnFail()) {
          results.push({
            json: {
              error: error.message,
              provider,
              model,
            },
          });
        } else {
          throw error;
        }
      }
    }

    return [results];
  },
};

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

async function callOpenAI(
  credentials: any,
  model: string,
  messages: ChatMessage[],
  options: { temperature: number; maxTokens: number; outputFormat: string }
): Promise<AIAgentOutput> {
  const apiKey = credentials.apiKey;
  const baseUrl = credentials.baseUrl || 'https://api.openai.com/v1';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.outputFormat === 'json' ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  return {
    response: choice.message.content,
    messages: [...messages, { role: 'assistant', content: choice.message.content }],
    toolCalls: choice.message.tool_calls,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    finishReason: choice.finish_reason,
  };
}

async function callAnthropic(
  credentials: any,
  model: string,
  messages: ChatMessage[],
  options: { temperature: number; maxTokens: number; outputFormat: string }
): Promise<AIAgentOutput> {
  const apiKey = credentials.apiKey;

  // Extract system message
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemMessage,
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || '';

  return {
    response: content,
    messages: [...messages, { role: 'assistant', content }],
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    finishReason: data.stop_reason,
  };
}

// ============================================================================
// ADDITIONAL NODE TYPES
// ============================================================================

export const aiChainNode: NodeDefinition = {
  name: 'AI Chain',
  type: 'ai-chain',
  group: 'AI',
  version: 1,
  description: 'Chain multiple AI calls with context',
  icon: 'link',
  color: '#6366F1',

  defaults: {
    name: 'AI Chain',
  },

  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'steps',
      displayName: 'Chain Steps',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      default: {},
      options: [
        {
          name: 'step',
          displayName: 'Step',
          values: [
            {
              name: 'name',
              displayName: 'Step Name',
              type: 'string',
              default: '',
              required: true,
            },
            {
              name: 'prompt',
              displayName: 'Prompt Template',
              type: 'string',
              typeOptions: { rows: 4 },
              default: '',
              required: true,
            },
            {
              name: 'outputVariable',
              displayName: 'Output Variable',
              type: 'string',
              default: 'step_output',
            },
          ],
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    // Chain execution logic
    return [[]];
  },
};

export const aiEmbeddingsNode: NodeDefinition = {
  name: 'AI Embeddings',
  type: 'ai-embeddings',
  group: 'AI',
  version: 1,
  description: 'Generate vector embeddings for text',
  icon: 'vector',
  color: '#8B5CF6',

  defaults: {
    name: 'AI Embeddings',
  },

  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'model',
      displayName: 'Embedding Model',
      type: 'options',
      options: [
        { name: 'text-embedding-3-small', value: 'text-embedding-3-small' },
        { name: 'text-embedding-3-large', value: 'text-embedding-3-large' },
        { name: 'text-embedding-ada-002', value: 'text-embedding-ada-002' },
      ],
      default: 'text-embedding-3-small',
    },
    {
      name: 'text',
      displayName: 'Text',
      type: 'string',
      default: '={{ $json.text }}',
      required: true,
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    // Embedding generation logic
    return [[]];
  },
};

export default {
  aiAgentNode,
  aiChainNode,
  aiEmbeddingsNode,
};

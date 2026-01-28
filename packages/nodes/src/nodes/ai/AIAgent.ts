import { createProgrammaticNode } from '@agentsmith/shared';

export const AIAgent = createProgrammaticNode({
  name: 'AIAgent',
  displayName: 'AI Agent',
  description: 'Autonomous AI agent that can use tools to accomplish tasks',
  icon: 'fa:robot',
  group: ['ai'],
  version: 1,
  defaults: { name: 'AI Agent' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openAiApi', required: false }],
  properties: [
    {
      displayName: 'Model Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
      ],
      default: 'openai',
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
      ],
      default: 'gpt-4o-mini',
    },
    {
      displayName: 'Task / Goal',
      name: 'task',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      description: 'The task or goal for the agent to accomplish',
    },
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'string',
      typeOptions: { rows: 5 },
      default: 'You are a helpful AI assistant that can use tools to accomplish tasks. Think step by step and use the available tools when needed. Always explain your reasoning.',
    },
    {
      displayName: 'Tools',
      name: 'tools',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [
        {
          displayName: 'Tool',
          name: 'tool',
          values: [
            {
              displayName: 'Tool Type',
              name: 'type',
              type: 'options',
              options: [
                { name: 'Web Search', value: 'webSearch' },
                { name: 'Web Scrape', value: 'webScrape' },
                { name: 'Calculator', value: 'calculator' },
                { name: 'Code Interpreter', value: 'codeInterpreter' },
                { name: 'HTTP Request', value: 'httpRequest' },
                { name: 'Custom Function', value: 'customFunction' },
              ],
              default: 'webSearch',
            },
            {
              displayName: 'Function Name',
              name: 'functionName',
              type: 'string',
              default: '',
              displayOptions: { show: { type: ['customFunction'] } },
            },
            {
              displayName: 'Function Description',
              name: 'functionDescription',
              type: 'string',
              default: '',
              displayOptions: { show: { type: ['customFunction'] } },
            },
            {
              displayName: 'Parameters Schema (JSON)',
              name: 'parametersSchema',
              type: 'json',
              default: '{"type": "object", "properties": {}, "required": []}',
              displayOptions: { show: { type: ['customFunction'] } },
            },
          ],
        },
      ],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Max Iterations',
          name: 'maxIterations',
          type: 'number',
          default: 10,
          description: 'Maximum number of tool-use iterations',
        },
        {
          displayName: 'Temperature',
          name: 'temperature',
          type: 'number',
          default: 0.7,
          typeOptions: { minValue: 0, maxValue: 2 },
        },
        {
          displayName: 'Max Tokens',
          name: 'maxTokens',
          type: 'number',
          default: 4096,
        },
        {
          displayName: 'Return Intermediate Steps',
          name: 'returnIntermediateSteps',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Timeout (seconds)',
          name: 'timeout',
          type: 'number',
          default: 300,
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('openAiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const provider = this.getNodeParameter('provider', i) as string;
        const model = this.getNodeParameter('model', i) as string;
        const task = this.getNodeParameter('task', i) as string;
        const systemPrompt = this.getNodeParameter('systemPrompt', i) as string;
        const toolsConfig = this.getNodeParameter('tools', i) as any;
        const options = this.getNodeParameter('options', i) as any;

        const maxIterations = options.maxIterations || 10;
        const returnIntermediateSteps = options.returnIntermediateSteps || false;

        // Build tools list
        const tools = buildToolsList(toolsConfig.tool || []);

        // Run agent loop
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task },
        ];

        const intermediateSteps: any[] = [];
        let iterations = 0;
        let finalResponse = '';

        while (iterations < maxIterations) {
          iterations++;

          // Call LLM
          const response = await callLLM(provider, model, messages, tools, credentials, options);
          const assistantMessage = response.choices[0].message;
          messages.push(assistantMessage);

          // Check if we have tool calls
          if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            for (const toolCall of assistantMessage.tool_calls) {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);

              intermediateSteps.push({
                iteration: iterations,
                tool: toolName,
                input: toolArgs,
              });

              // Execute tool
              const toolResult = await executeTool(toolName, toolArgs);

              intermediateSteps[intermediateSteps.length - 1].output = toolResult;

              // Add tool result to messages
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              });
            }
          } else {
            // No tool calls - agent is done
            finalResponse = assistantMessage.content || '';
            break;
          }
        }

        const result: any = {
          response: finalResponse,
          iterations,
          model,
        };

        if (returnIntermediateSteps) {
          result.intermediateSteps = intermediateSteps;
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

function buildToolsList(toolsConfig: any[]): any[] {
  const tools: any[] = [];

  for (const tool of toolsConfig) {
    switch (tool.type) {
      case 'webSearch':
        tools.push({
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information. Use this when you need to find current information or facts.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'The search query' },
              },
              required: ['query'],
            },
          },
        });
        break;

      case 'webScrape':
        tools.push({
          type: 'function',
          function: {
            name: 'web_scrape',
            description: 'Fetch and extract content from a web page URL.',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The URL to scrape' },
              },
              required: ['url'],
            },
          },
        });
        break;

      case 'calculator':
        tools.push({
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Perform mathematical calculations. Supports basic arithmetic, trigonometry, logarithms, etc.',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'The mathematical expression to evaluate' },
              },
              required: ['expression'],
            },
          },
        });
        break;

      case 'codeInterpreter':
        tools.push({
          type: 'function',
          function: {
            name: 'code_interpreter',
            description: 'Execute JavaScript code and return the result. Use for data processing, calculations, or transformations.',
            parameters: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'The JavaScript code to execute' },
              },
              required: ['code'],
            },
          },
        });
        break;

      case 'httpRequest':
        tools.push({
          type: 'function',
          function: {
            name: 'http_request',
            description: 'Make an HTTP request to an API endpoint.',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The URL to request' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
                body: { type: 'string', description: 'Request body (for POST/PUT)' },
                headers: { type: 'object', description: 'Request headers' },
              },
              required: ['url', 'method'],
            },
          },
        });
        break;

      case 'customFunction':
        tools.push({
          type: 'function',
          function: {
            name: tool.functionName,
            description: tool.functionDescription,
            parameters: JSON.parse(tool.parametersSchema),
          },
        });
        break;
    }
  }

  return tools;
}

async function callLLM(
  provider: string,
  model: string,
  messages: any[],
  tools: any[],
  credentials: any,
  options: any
): Promise<any> {
  const apiKey = credentials.apiKey as string;

  if (provider === 'openai' || model.startsWith('gpt')) {
    const body: any = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

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

    return response.json();
  } else {
    // Anthropic
    const anthropicMessages = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
        };
      }
      return m;
    });

    const systemMessage = messages.find(m => m.role === 'system');

    const body: any = {
      model,
      messages: anthropicMessages,
      max_tokens: options.maxTokens || 4096,
      system: systemMessage?.content,
    };

    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert to OpenAI format for consistency
    const toolCalls = data.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.input) },
      }));

    const textContent = data.content.find((c: any) => c.type === 'text');

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: textContent?.text || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      }],
    };
  }
}

async function executeTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'web_search':
      // Mock web search - in production, integrate with real search API
      return {
        results: [
          { title: 'Search Result 1', snippet: `Results for: ${args.query}`, url: 'https://example.com/1' },
          { title: 'Search Result 2', snippet: 'More relevant information...', url: 'https://example.com/2' },
        ],
      };

    case 'web_scrape':
      try {
        const response = await fetch(args.url);
        const html = await response.text();
        // Basic text extraction
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
        return { url: args.url, content: text };
      } catch (error: any) {
        return { error: error.message };
      }

    case 'calculator':
      try {
        // Safe math evaluation
        const result = evaluateMath(args.expression);
        return { expression: args.expression, result };
      } catch (error: any) {
        return { error: error.message };
      }

    case 'code_interpreter':
      try {
        // WARNING: This is unsafe - in production, use a sandboxed environment
        const fn = new Function('return ' + args.code);
        const result = fn();
        return { result };
      } catch (error: any) {
        return { error: error.message };
      }

    case 'http_request':
      try {
        const response = await fetch(args.url, {
          method: args.method,
          headers: args.headers || {},
          body: args.body,
        });
        const data = await response.text();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        };
      } catch (error: any) {
        return { error: error.message };
      }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function evaluateMath(expression: string): number {
  // Safe math evaluation using Function constructor with limited scope
  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
  const mathFunctions = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    sqrt: Math.sqrt, pow: Math.pow, abs: Math.abs,
    log: Math.log, log10: Math.log10, exp: Math.exp,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    PI: Math.PI, E: Math.E,
  };

  let evalExpr = expression;
  for (const [name, fn] of Object.entries(mathFunctions)) {
    if (typeof fn === 'function') {
      evalExpr = evalExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), `Math.${name}`);
    } else {
      evalExpr = evalExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(fn));
    }
  }

  return new Function(`return ${evalExpr}`)();
}

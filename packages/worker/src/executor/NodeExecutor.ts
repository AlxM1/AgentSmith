// Node Executor

import type { INode, INodeExecutionOutput } from '@agentsmith/shared';
import axios from 'axios';
import { logger } from '../lib/logger.js';

export class NodeExecutor {
  async execute(
    node: INode,
    inputData: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const handler = this.getHandler(node.type);
    return handler(node, inputData);
  }

  private getHandler(
    nodeType: string
  ): (node: INode, input: INodeExecutionOutput[]) => Promise<INodeExecutionOutput[]> {
    const handlers: Record<
      string,
      (node: INode, input: INodeExecutionOutput[]) => Promise<INodeExecutionOutput[]>
    > = {
      'agentsmith.manualTrigger': this.handleManualTrigger.bind(this),
      'agentsmith.webhookTrigger': this.handleWebhookTrigger.bind(this),
      'agentsmith.scheduleTrigger': this.handleScheduleTrigger.bind(this),
      'agentsmith.set': this.handleSet.bind(this),
      'agentsmith.code': this.handleCode.bind(this),
      'agentsmith.httpRequest': this.handleHttpRequest.bind(this),
      'agentsmith.if': this.handleIf.bind(this),
      'agentsmith.merge': this.handleMerge.bind(this),
      'agentsmith.wait': this.handleWait.bind(this),
      'agentsmith.noOp': this.handleNoOp.bind(this),
    };

    return handlers[nodeType] || this.handleDefault.bind(this);
  }

  // Trigger handlers
  private async handleManualTrigger(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    return input.length > 0 ? input : [{ json: { triggered: true, timestamp: new Date().toISOString() } }];
  }

  private async handleWebhookTrigger(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    return input;
  }

  private async handleScheduleTrigger(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    return [{ json: { triggered: true, timestamp: new Date().toISOString() } }];
  }

  // Transform handlers
  private async handleSet(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const params = node.parameters as {
      values?: {
        string?: Array<{ name: string; value: string }>;
        number?: Array<{ name: string; value: number }>;
        boolean?: Array<{ name: string; value: boolean }>;
      };
      keepOnlySet?: boolean;
    };

    return input.map((item) => {
      const newJson = params.keepOnlySet ? {} : { ...item.json };

      // Set string values
      if (params.values?.string) {
        for (const { name, value } of params.values.string) {
          newJson[name] = value;
        }
      }

      // Set number values
      if (params.values?.number) {
        for (const { name, value } of params.values.number) {
          newJson[name] = value;
        }
      }

      // Set boolean values
      if (params.values?.boolean) {
        for (const { name, value } of params.values.boolean) {
          newJson[name] = value;
        }
      }

      return { ...item, json: newJson };
    });
  }

  private async handleCode(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const params = node.parameters as {
      jsCode?: string;
      mode?: 'runOnceForAllItems' | 'runOnceForEachItem';
    };

    const code = params.jsCode || 'return items;';

    try {
      // Create a sandboxed function
      // WARNING: In production, use a proper sandbox like vm2
      const fn = new Function('items', '$input', '$json', code);

      if (params.mode === 'runOnceForEachItem') {
        return input.map((item) => {
          const result = fn([item], { all: () => input, first: () => input[0], item }, item.json);
          return Array.isArray(result) ? result[0] : result;
        });
      } else {
        const result = fn(
          input,
          { all: () => input, first: () => input[0], item: input[0] },
          input[0]?.json || {}
        );
        return Array.isArray(result) ? result : [result];
      }
    } catch (error) {
      logger.error('Code execution error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Action handlers
  private async handleHttpRequest(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const params = node.parameters as {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: unknown;
      queryParameters?: Record<string, string>;
    };

    const results: INodeExecutionOutput[] = [];

    for (const item of input) {
      try {
        // Resolve expressions in URL and other params
        const url = this.resolveExpression(params.url || '', item.json);

        const response = await axios({
          method: (params.method || 'GET').toLowerCase() as 'get' | 'post' | 'put' | 'delete',
          url,
          headers: params.headers,
          data: params.body,
          params: params.queryParameters,
          validateStatus: () => true, // Don't throw on non-2xx
        });

        results.push({
          json: {
            statusCode: response.status,
            headers: response.headers,
            body: response.data,
          },
        });
      } catch (error) {
        results.push({
          json: {
            error: true,
            message: error instanceof Error ? error.message : 'Request failed',
          },
        });
      }
    }

    return results;
  }

  // Flow handlers
  private async handleIf(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const params = node.parameters as {
      conditions?: {
        string?: Array<{
          value1: string;
          operation: string;
          value2: string;
        }>;
      };
    };

    // Simple implementation - check first string condition
    const condition = params.conditions?.string?.[0];
    if (!condition) {
      return input; // No condition, pass through
    }

    return input.filter((item) => {
      const value1 = this.resolveExpression(condition.value1, item.json);
      const value2 = condition.value2;

      switch (condition.operation) {
        case 'equals':
          return value1 === value2;
        case 'notEquals':
          return value1 !== value2;
        case 'contains':
          return String(value1).includes(value2);
        case 'startsWith':
          return String(value1).startsWith(value2);
        case 'endsWith':
          return String(value1).endsWith(value2);
        default:
          return true;
      }
    });
  }

  private async handleMerge(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    // Simple merge - combine all inputs
    return input;
  }

  // Utility handlers
  private async handleWait(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const params = node.parameters as {
      amount?: number;
      unit?: 'seconds' | 'minutes' | 'hours';
    };

    const amount = params.amount || 1;
    const unit = params.unit || 'seconds';

    const multipliers = { seconds: 1000, minutes: 60000, hours: 3600000 };
    const ms = amount * multipliers[unit];

    await new Promise((resolve) => setTimeout(resolve, ms));

    return input;
  }

  private async handleNoOp(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    return input;
  }

  private async handleDefault(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    logger.warn(`Unknown node type: ${node.type}, passing through`);
    return input;
  }

  // Helper to resolve simple expressions like {{ $json.field }}
  private resolveExpression(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{\s*\$json\.(\w+)\s*\}\}/g, (_, key) => {
      return String(context[key] ?? '');
    });
  }
}

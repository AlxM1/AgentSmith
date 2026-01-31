// Node Executor

import type { INode, INodeExecutionOutput } from '@agentsmith/shared';
import axios from 'axios';
import { logger } from '../lib/logger.js';
import { executeCodeSafe, SandboxError } from '../lib/sandbox.js';
import {
  resolveExpressions,
  resolveExpressionsDeep,
  createExpressionContext,
  type ExpressionItem,
  type ExpressionContext,
} from '../lib/expression.js';

// Execution context passed to NodeExecutor
export interface NodeExecutionContext {
  executionId: string;
  executionMode: string;
  workflowId: string;
  workflowName: string;
  nodeOutputs?: Record<string, INodeExecutionOutput[]>;
}

export class NodeExecutor {
  private executionContext: NodeExecutionContext | null = null;

  /**
   * Set execution context for expression resolution
   */
  setExecutionContext(context: NodeExecutionContext): void {
    this.executionContext = context;
  }

  /**
   * Execute a node with the given input data
   */
  async execute(
    node: INode,
    inputData: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const handler = this.getHandler(node.type);
    return handler(node, inputData);
  }

  /**
   * Create expression context for the current item
   */
  private createExprContext(
    inputItems: INodeExecutionOutput[],
    itemIndex: number = 0,
    previousNodeName?: string
  ): ExpressionContext {
    const items: ExpressionItem[] = inputItems.map(item => ({
      json: item.json as Record<string, unknown>,
      binary: item.binary as Record<string, unknown>,
    }));

    return createExpressionContext({
      inputItems: items,
      itemIndex,
      runIndex: 0,
      nodeOutputs: this.executionContext?.nodeOutputs as Record<string, ExpressionItem[]>,
      executionId: this.executionContext?.executionId || 'unknown',
      executionMode: this.executionContext?.executionMode || 'manual',
      workflowId: this.executionContext?.workflowId || 'unknown',
      workflowName: this.executionContext?.workflowName || 'Unknown Workflow',
      workflowActive: true,
      previousNodeName,
    });
  }

  /**
   * Resolve expressions in node parameters
   */
  private resolveParams<T>(
    params: T,
    input: INodeExecutionOutput[],
    itemIndex: number = 0
  ): T {
    const context = this.createExprContext(input, itemIndex);
    return resolveExpressionsDeep(params, context) as T;
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
    return input.map((item, i) => {
      // Resolve expressions in parameters for this item
      const params = this.resolveParams(node.parameters as {
        values?: {
          string?: Array<{ name: string; value: string }>;
          number?: Array<{ name: string; value: number }>;
          boolean?: Array<{ name: string; value: boolean }>;
        };
        keepOnlySet?: boolean;
        mode?: 'manual' | 'raw';
        rawData?: unknown;
      }, input, i);

      // Handle raw mode
      if (params.mode === 'raw' && params.rawData !== undefined) {
        return { ...item, json: params.rawData as Record<string, unknown> };
      }

      const newJson: Record<string, unknown> = params.keepOnlySet ? {} : { ...item.json };

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
      timeout?: number;
    };

    const code = params.jsCode || 'return items;';
    const timeout = params.timeout || 30000; // 30 seconds default

    try {
      if (params.mode === 'runOnceForEachItem') {
        // Execute code once for each item
        const results: INodeExecutionOutput[] = [];

        for (let i = 0; i < input.length; i++) {
          const item = input[i];
          const { result, logs } = await executeCodeSafe<INodeExecutionOutput | INodeExecutionOutput[]>(
            code,
            [item],
            {
              timeout,
              nodeId: node.id,
              nodeName: node.name,
              executionMode: 'runOnceForEachItem',
            }
          );

          // Log any console output from the code
          for (const log of logs) {
            logger.debug(`[Code Node ${node.name}] ${log.level}:`, ...log.args);
          }

          // Handle result
          if (Array.isArray(result)) {
            results.push(...result.map(r => ({ json: r as unknown as Record<string, unknown> })));
          } else if (result && typeof result === 'object') {
            results.push({ json: result as unknown as Record<string, unknown> });
          }
        }

        return results.length > 0 ? results : input;
      } else {
        // Execute code once for all items
        const { result, logs } = await executeCodeSafe<INodeExecutionOutput[] | unknown>(
          code,
          input,
          {
            timeout,
            nodeId: node.id,
            nodeName: node.name,
            executionMode: 'runOnceForAllItems',
          }
        );

        // Log any console output from the code
        for (const log of logs) {
          logger.debug(`[Code Node ${node.name}] ${log.level}:`, ...log.args);
        }

        // Handle different return types
        if (Array.isArray(result)) {
          return result.map(item => {
            if (item && typeof item === 'object' && 'json' in item) {
              return item as INodeExecutionOutput;
            }
            return { json: item as Record<string, unknown> };
          });
        } else if (result && typeof result === 'object') {
          return [{ json: result as Record<string, unknown> }];
        }

        return input;
      }
    } catch (error) {
      if (error instanceof SandboxError) {
        logger.error('Sandboxed code execution failed:', {
          nodeId: error.nodeId,
          executionTime: error.executionTime,
          error: error.message,
          logs: error.logs,
        });
      } else {
        logger.error('Code execution error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  // Action handlers
  private async handleHttpRequest(
    node: INode,
    input: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const results: INodeExecutionOutput[] = [];

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      try {
        // Resolve all expressions in parameters for this item
        const resolvedParams = this.resolveParams(node.parameters as {
          method?: string;
          url?: string;
          headers?: Record<string, string>;
          body?: unknown;
          queryParameters?: Record<string, string>;
          authentication?: string;
          timeout?: number;
        }, input, i);

        const response = await axios({
          method: (resolvedParams.method || 'GET').toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch',
          url: resolvedParams.url || '',
          headers: resolvedParams.headers,
          data: resolvedParams.body,
          params: resolvedParams.queryParameters,
          timeout: resolvedParams.timeout || 30000,
          validateStatus: () => true, // Don't throw on non-2xx
        });

        results.push({
          json: {
            statusCode: response.status,
            statusText: response.statusText,
            headers: response.headers as Record<string, unknown>,
            body: response.data,
          },
        });
      } catch (error) {
        results.push({
          json: {
            error: true,
            message: error instanceof Error ? error.message : 'Request failed',
            code: (error as any).code,
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
    const trueOutput: INodeExecutionOutput[] = [];
    const falseOutput: INodeExecutionOutput[] = [];

    for (let i = 0; i < input.length; i++) {
      const item = input[i];

      // Resolve expressions in parameters for this item
      const params = this.resolveParams(node.parameters as {
        conditions?: {
          string?: Array<{
            value1: unknown;
            operation: string;
            value2: unknown;
          }>;
          number?: Array<{
            value1: unknown;
            operation: string;
            value2: unknown;
          }>;
          boolean?: Array<{
            value1: unknown;
            operation: string;
            value2: unknown;
          }>;
        };
        combineOperation?: 'and' | 'or';
      }, input, i);

      // Evaluate all conditions
      const results: boolean[] = [];

      // String conditions
      if (params.conditions?.string) {
        for (const cond of params.conditions.string) {
          results.push(this.evaluateCondition(cond.value1, cond.operation, cond.value2));
        }
      }

      // Number conditions
      if (params.conditions?.number) {
        for (const cond of params.conditions.number) {
          results.push(this.evaluateCondition(cond.value1, cond.operation, cond.value2));
        }
      }

      // Boolean conditions
      if (params.conditions?.boolean) {
        for (const cond of params.conditions.boolean) {
          results.push(this.evaluateCondition(cond.value1, cond.operation, cond.value2));
        }
      }

      // Combine results
      let passes: boolean;
      if (results.length === 0) {
        passes = true; // No conditions = pass
      } else if (params.combineOperation === 'or') {
        passes = results.some(r => r);
      } else {
        passes = results.every(r => r);
      }

      if (passes) {
        trueOutput.push(item);
      } else {
        falseOutput.push(item);
      }
    }

    // Return true output (the "true" branch)
    // In a real implementation, we'd return both branches for routing
    return trueOutput;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(value1: unknown, operation: string, value2: unknown): boolean {
    switch (operation) {
      case 'equals':
      case 'equal':
        return value1 === value2;
      case 'notEquals':
      case 'notEqual':
        return value1 !== value2;
      case 'contains':
        return String(value1).includes(String(value2));
      case 'notContains':
        return !String(value1).includes(String(value2));
      case 'startsWith':
        return String(value1).startsWith(String(value2));
      case 'endsWith':
        return String(value1).endsWith(String(value2));
      case 'regex':
        try {
          return new RegExp(String(value2)).test(String(value1));
        } catch {
          return false;
        }
      case 'larger':
      case 'greaterThan':
        return Number(value1) > Number(value2);
      case 'largerEqual':
      case 'greaterThanOrEqual':
        return Number(value1) >= Number(value2);
      case 'smaller':
      case 'lessThan':
        return Number(value1) < Number(value2);
      case 'smallerEqual':
      case 'lessThanOrEqual':
        return Number(value1) <= Number(value2);
      case 'isEmpty':
        return value1 === null || value1 === undefined || value1 === '' ||
               (Array.isArray(value1) && value1.length === 0);
      case 'isNotEmpty':
        return value1 !== null && value1 !== undefined && value1 !== '' &&
               !(Array.isArray(value1) && value1.length === 0);
      case 'isTrue':
        return value1 === true || value1 === 'true' || value1 === 1;
      case 'isFalse':
        return value1 === false || value1 === 'false' || value1 === 0;
      default:
        logger.warn(`Unknown condition operation: ${operation}`);
        return true;
    }
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
}

// Workflow Executor

import type {
  IWorkflow,
  INode,
  IConnection,
  ExecutionMode,
  IExecutionData,
  IRunData,
  INodeRunData,
  INodeExecutionOutput,
  IExecutionError,
} from '@agentsmith/shared';
import { logger } from '../lib/logger.js';
import { NodeExecutor } from './NodeExecutor.js';

interface ExecutorOptions {
  mode: ExecutionMode;
  executionId: string;
  timeout?: number;
}

export class WorkflowExecutor {
  private workflow: IWorkflow;
  private options: ExecutorOptions;
  private nodeExecutor: NodeExecutor;
  private runData: IRunData = {};
  private startTime: number = 0;

  constructor(workflow: IWorkflow, options: ExecutorOptions) {
    this.workflow = workflow;
    this.options = options;
    this.nodeExecutor = new NodeExecutor();
  }

  async execute(inputData?: Record<string, unknown>): Promise<IExecutionData> {
    this.startTime = Date.now();
    this.runData = {};

    logger.info(`Starting workflow execution: ${this.options.executionId}`, {
      workflowId: this.workflow.id,
      nodeCount: this.workflow.nodes.length,
    });

    try {
      // Find trigger nodes (starting points)
      const triggerNodes = this.workflow.nodes.filter(
        (node) => this.isTriggerNode(node)
      );

      if (triggerNodes.length === 0) {
        throw new Error('Workflow has no trigger node');
      }

      // Start execution from trigger node
      const triggerNode = triggerNodes[0];
      const triggerOutput: INodeExecutionOutput[] = inputData
        ? [{ json: inputData }]
        : [{ json: {} }];

      // Execute trigger
      await this.executeNode(triggerNode, triggerOutput);

      // Execute downstream nodes
      await this.executeDownstreamNodes(triggerNode.id);

      return this.buildExecutionData('success');
    } catch (error) {
      logger.error(`Workflow execution error: ${this.options.executionId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.buildExecutionData('failed', error);
    }
  }

  private async executeNode(
    node: INode,
    inputData: INodeExecutionOutput[]
  ): Promise<INodeExecutionOutput[]> {
    const startTime = Date.now();

    logger.debug(`Executing node: ${node.name}`, {
      nodeId: node.id,
      nodeType: node.type,
    });

    try {
      // Skip disabled nodes
      if (node.disabled) {
        return inputData;
      }

      // Execute the node
      const result = await this.nodeExecutor.execute(node, inputData);

      // Store run data
      const runData: INodeRunData = {
        startTime,
        executionTime: Date.now() - startTime,
        executionStatus: 'success',
        data: { main: [result] },
        source: null,
      };

      if (!this.runData[node.name]) {
        this.runData[node.name] = [];
      }
      this.runData[node.name].push(runData);

      logger.debug(`Node executed successfully: ${node.name}`, {
        executionTime: runData.executionTime,
        outputItems: result.length,
      });

      return result;
    } catch (error) {
      const runData: INodeRunData = {
        startTime,
        executionTime: Date.now() - startTime,
        executionStatus: 'error',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
          node: { name: node.name, type: node.type },
        },
        source: null,
      };

      if (!this.runData[node.name]) {
        this.runData[node.name] = [];
      }
      this.runData[node.name].push(runData);

      // Check if we should continue on fail
      if (node.continueOnFail) {
        return inputData;
      }

      throw error;
    }
  }

  private async executeDownstreamNodes(sourceNodeId: string): Promise<void> {
    // Find connections from this node
    const connections = this.workflow.connections.filter(
      (conn) => conn.source === sourceNodeId
    );

    for (const connection of connections) {
      const targetNode = this.workflow.nodes.find(
        (n) => n.id === connection.target
      );

      if (!targetNode) continue;

      // Get output from source node
      const sourceNode = this.workflow.nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) continue;

      const sourceRunData = this.runData[sourceNode.name];
      if (!sourceRunData || sourceRunData.length === 0) continue;

      const lastRun = sourceRunData[sourceRunData.length - 1];
      if (!lastRun.data?.main?.[0]) continue;

      // Execute target node
      const result = await this.executeNode(targetNode, lastRun.data.main[0]);

      // Continue downstream
      await this.executeDownstreamNodes(targetNode.id);
    }
  }

  private isTriggerNode(node: INode): boolean {
    return (
      node.type.toLowerCase().includes('trigger') ||
      node.type === 'agentsmith.manualTrigger' ||
      node.type === 'agentsmith.webhookTrigger' ||
      node.type === 'agentsmith.scheduleTrigger'
    );
  }

  private buildExecutionData(
    status: 'success' | 'failed',
    error?: unknown
  ): IExecutionData {
    const executionData: IExecutionData = {
      resultData: {
        runData: this.runData,
      },
    };

    if (status === 'failed' && error) {
      executionData.resultData.metadata = {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }

    return executionData;
  }
}

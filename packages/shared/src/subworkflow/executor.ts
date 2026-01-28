/**
 * Sub-Workflow Executor
 * Handles execution of workflows within workflows
 */

import type {
  SubWorkflowInput,
  SubWorkflowResult,
  SubWorkflowOptions,
  SubWorkflowCall,
  SubWorkflowReference,
} from './types';

const DEFAULT_OPTIONS: Required<SubWorkflowOptions> = {
  waitForCompletion: true,
  timeout: 300000, // 5 minutes
  maxDepth: 10,
  continueOnFail: false,
  credentialOverrides: {},
  staticData: {},
};

export class SubWorkflowExecutor {
  private activeCalls: Map<string, SubWorkflowCall> = new Map();
  private workflowLoader?: (ref: SubWorkflowReference) => Promise<any>;
  private executionRunner?: (workflow: any, input: any, options: any) => Promise<SubWorkflowResult>;
  private currentDepth: number = 0;

  /**
   * Set the workflow loader function
   */
  setWorkflowLoader(loader: (ref: SubWorkflowReference) => Promise<any>) {
    this.workflowLoader = loader;
  }

  /**
   * Set the execution runner function
   */
  setExecutionRunner(runner: (workflow: any, input: any, options: any) => Promise<SubWorkflowResult>) {
    this.executionRunner = runner;
  }

  /**
   * Execute a sub-workflow
   */
  async execute(input: SubWorkflowInput, context: {
    parentExecutionId: string;
    parentNodeId: string;
    depth?: number;
  }): Promise<SubWorkflowResult> {
    const options = { ...DEFAULT_OPTIONS, ...input.options };
    const depth = context.depth ?? this.currentDepth + 1;

    // Check max depth
    if (depth > options.maxDepth) {
      throw new Error(`Maximum sub-workflow depth (${options.maxDepth}) exceeded`);
    }

    // Create call record
    const callId = `swc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const call: SubWorkflowCall = {
      id: callId,
      parentExecutionId: context.parentExecutionId,
      parentNodeId: context.parentNodeId,
      subWorkflowId: input.workflowId,
      status: 'queued',
      inputData: input.inputData,
      queuedAt: new Date(),
    };

    this.activeCalls.set(callId, call);

    try {
      // Load the workflow
      if (!this.workflowLoader) {
        throw new Error('Workflow loader not configured');
      }

      const workflow = await this.workflowLoader({
        type: 'id',
        value: input.workflowId,
        version: input.versionId ? parseInt(input.versionId) : 'latest',
      });

      if (!workflow) {
        throw new Error(`Workflow not found: ${input.workflowId}`);
      }

      // Update call status
      call.status = 'running';
      call.startedAt = new Date();

      // Execute the workflow
      if (!this.executionRunner) {
        throw new Error('Execution runner not configured');
      }

      const result = await Promise.race([
        this.executionRunner(workflow, input.inputData, {
          ...options,
          depth,
          parentExecutionId: context.parentExecutionId,
        }),
        this.createTimeout(options.timeout),
      ]);

      // Handle result
      if (result.status === 'error' && !options.continueOnFail) {
        call.status = 'failed';
        call.error = result.error?.message;
        throw new Error(result.error?.message || 'Sub-workflow execution failed');
      }

      call.status = 'completed';
      call.outputData = result.outputData;
      call.completedAt = new Date();
      call.subWorkflowExecutionId = result.executionId;

      return result;
    } catch (error: any) {
      call.status = 'failed';
      call.error = error.message;
      call.completedAt = new Date();

      if (options.continueOnFail) {
        return {
          executionId: callId,
          workflowId: input.workflowId,
          status: 'error',
          startedAt: call.startedAt || call.queuedAt,
          finishedAt: new Date(),
          error: {
            message: error.message,
            stack: error.stack,
          },
          metadata: {
            depth,
            parentExecutionId: context.parentExecutionId,
            nodeCount: 0,
          },
        };
      }

      throw error;
    } finally {
      // Clean up call record after some time
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 60000);
    }
  }

  /**
   * Execute a sub-workflow without waiting for completion
   */
  async executeAsync(input: SubWorkflowInput, context: {
    parentExecutionId: string;
    parentNodeId: string;
  }): Promise<{ callId: string; executionId: string }> {
    const callId = `swc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start execution in background
    this.execute(input, context).catch(err => {
      console.error(`Background sub-workflow ${callId} failed:`, err);
    });

    return { callId, executionId };
  }

  /**
   * Get the status of a sub-workflow call
   */
  getCallStatus(callId: string): SubWorkflowCall | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Get all active calls for a parent execution
   */
  getActiveCalls(parentExecutionId: string): SubWorkflowCall[] {
    return Array.from(this.activeCalls.values()).filter(
      call => call.parentExecutionId === parentExecutionId
    );
  }

  /**
   * Cancel a sub-workflow call
   */
  async cancelCall(callId: string): Promise<boolean> {
    const call = this.activeCalls.get(callId);
    if (!call || call.status === 'completed' || call.status === 'failed') {
      return false;
    }

    call.status = 'failed';
    call.error = 'Cancelled by parent';
    call.completedAt = new Date();

    return true;
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Sub-workflow execution timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Map input data using field mappings
   */
  mapInputData(
    sourceData: Record<string, any>,
    mapping: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [targetField, sourceExpression] of Object.entries(mapping)) {
      result[targetField] = this.resolveExpression(sourceData, sourceExpression);
    }

    return result;
  }

  /**
   * Map output data using field mappings
   */
  mapOutputData(
    outputData: Record<string, any>[],
    mapping: Record<string, string>
  ): Record<string, any>[] {
    return outputData.map(item => {
      const result: Record<string, any> = {};

      for (const [targetField, sourceExpression] of Object.entries(mapping)) {
        result[targetField] = this.resolveExpression(item, sourceExpression);
      }

      return result;
    });
  }

  /**
   * Resolve a simple expression (supports dot notation)
   */
  private resolveExpression(data: Record<string, any>, expression: string): any {
    if (expression.startsWith('$')) {
      // Direct field reference
      const fieldPath = expression.substring(1);
      return this.getNestedValue(data, fieldPath);
    }
    return expression;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }
}

// Singleton instance
export const subWorkflowExecutor = new SubWorkflowExecutor();

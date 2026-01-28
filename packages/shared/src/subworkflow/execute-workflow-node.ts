/**
 * Execute Workflow Node
 * A node that executes another workflow
 */

import { createProgrammaticNode } from '../sdk/node-builder';
import type { INodeExecutionData, IExecuteFunctions } from '../sdk/types';
import { subWorkflowExecutor } from './executor';

export const ExecuteWorkflow = createProgrammaticNode({
  name: 'executeWorkflow',
  displayName: 'Execute Workflow',
  description: 'Execute another workflow as a sub-workflow',
  icon: 'fa:sitemap',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Execute Workflow',
  },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Source',
      name: 'source',
      type: 'options',
      options: [
        { name: 'Database', value: 'database' },
        { name: 'Parameter', value: 'parameter' },
        { name: 'URL', value: 'url' },
      ],
      default: 'database',
      description: 'Where to load the workflow from',
    },
    {
      displayName: 'Workflow ID',
      name: 'workflowId',
      type: 'string',
      default: '',
      required: true,
      displayOptions: {
        show: {
          source: ['database'],
        },
      },
    },
    {
      displayName: 'Workflow JSON',
      name: 'workflowJson',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          source: ['parameter'],
        },
      },
    },
    {
      displayName: 'Workflow URL',
      name: 'workflowUrl',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          source: ['url'],
        },
      },
    },
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        {
          name: 'Run Once for All Items',
          value: 'once',
          description: 'Pass all items to the sub-workflow at once',
        },
        {
          name: 'Run Once for Each Item',
          value: 'each',
          description: 'Run the sub-workflow for each item separately',
        },
      ],
      default: 'once',
    },
    {
      displayName: 'Version',
      name: 'version',
      type: 'options',
      options: [
        { name: 'Latest', value: 'latest' },
        { name: 'Published', value: 'published' },
        { name: 'Specific Version', value: 'specific' },
      ],
      default: 'latest',
      displayOptions: {
        show: {
          source: ['database'],
        },
      },
    },
    {
      displayName: 'Version Number',
      name: 'versionNumber',
      type: 'number',
      default: 1,
      displayOptions: {
        show: {
          source: ['database'],
          version: ['specific'],
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
          displayName: 'Wait for Sub-Workflow',
          name: 'waitForCompletion',
          type: 'boolean',
          default: true,
          description: 'Wait for the sub-workflow to complete before continuing',
        },
        {
          displayName: 'Timeout (ms)',
          name: 'timeout',
          type: 'number',
          default: 300000,
          description: 'Maximum time to wait for sub-workflow',
        },
        {
          displayName: 'Continue On Fail',
          name: 'continueOnFail',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Pass Parent Data',
          name: 'passParentData',
          type: 'boolean',
          default: true,
          description: 'Pass the input data to the sub-workflow',
        },
        {
          displayName: 'Input Field',
          name: 'inputField',
          type: 'string',
          default: '',
          description: 'Specific field to pass (empty = all data)',
        },
        {
          displayName: 'Output Field',
          name: 'outputField',
          type: 'string',
          default: '',
          description: 'Field name to store output (empty = merge with existing)',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const source = this.getNodeParameter('source', 0) as string;
    const mode = this.getNodeParameter('mode', 0) as string;
    const options = this.getNodeParameter('options', 0, {}) as Record<string, any>;

    // Get workflow reference
    let workflowId = '';
    if (source === 'database') {
      workflowId = this.getNodeParameter('workflowId', 0) as string;
    }

    const executeForItems = async (inputItems: INodeExecutionData[]): Promise<INodeExecutionData[]> => {
      const inputData = options.passParentData !== false
        ? inputItems.map(item => {
            if (options.inputField) {
              return { [options.inputField]: item.json[options.inputField] };
            }
            return item.json;
          })
        : [{}];

      try {
        const result = await subWorkflowExecutor.execute(
          {
            workflowId,
            inputData: { items: inputData },
            options: {
              waitForCompletion: options.waitForCompletion !== false,
              timeout: options.timeout || 300000,
              continueOnFail: options.continueOnFail || false,
            },
          },
          {
            parentExecutionId: 'current-execution', // Would come from context
            parentNodeId: 'execute-workflow-node', // Would come from context
          }
        );

        if (result.status === 'success' && result.outputData) {
          return result.outputData.map((data, index) => {
            const outputJson = options.outputField
              ? { [options.outputField]: data }
              : data;

            return {
              json: {
                ...(inputItems[index]?.json || {}),
                ...outputJson,
              },
              pairedItem: { item: index },
            };
          });
        }

        if (result.status === 'error') {
          if (options.continueOnFail) {
            return inputItems.map((item, index) => ({
              json: {
                ...item.json,
                error: result.error?.message,
              },
              pairedItem: { item: index },
            }));
          }
          throw new Error(result.error?.message || 'Sub-workflow failed');
        }

        return inputItems;
      } catch (error: any) {
        if (options.continueOnFail) {
          return inputItems.map((item, index) => ({
            json: {
              ...item.json,
              error: error.message,
            },
            pairedItem: { item: index },
          }));
        }
        throw error;
      }
    };

    if (mode === 'once') {
      // Execute once with all items
      const results = await executeForItems(items);
      returnData.push(...results);
    } else {
      // Execute for each item
      for (let i = 0; i < items.length; i++) {
        const results = await executeForItems([items[i]]);
        returnData.push(...results.map(r => ({
          ...r,
          pairedItem: { item: i },
        })));
      }
    }

    return [returnData];
  },
});

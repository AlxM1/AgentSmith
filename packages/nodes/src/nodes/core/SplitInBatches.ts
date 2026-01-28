import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const SplitInBatches = createProgrammaticNode({
  name: 'splitInBatches',
  displayName: 'Split In Batches',
  description: 'Split items into batches for batch processing',
  icon: 'fa:layer-group',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Split In Batches',
  },
  inputs: ['main'],
  outputs: ['main', 'main'],
  outputNames: ['loop', 'done'],
  properties: [
    {
      displayName: 'Batch Size',
      name: 'batchSize',
      type: 'number',
      default: 10,
      description: 'Number of items per batch',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Reset',
          name: 'reset',
          type: 'boolean',
          default: false,
          description: 'Reset the batch state and start over',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const batchSize = this.getNodeParameter('batchSize', 0) as number;
    const options = this.getNodeParameter('options', 0, {}) as Record<string, any>;

    // Get workflow static data for tracking batch state
    const staticData = this.getWorkflowStaticData('node');

    if (options.reset || !staticData.currentBatch) {
      staticData.currentBatch = 0;
      staticData.items = items;
    }

    const allItems = staticData.items as INodeExecutionData[];
    const currentBatch = staticData.currentBatch as number;
    const startIndex = currentBatch * batchSize;
    const endIndex = Math.min(startIndex + batchSize, allItems.length);

    const batchItems = allItems.slice(startIndex, endIndex);

    if (endIndex >= allItems.length) {
      // Last batch - output to "done"
      delete staticData.currentBatch;
      delete staticData.items;
      return [[], batchItems];
    } else {
      // More batches remaining - output to "loop"
      staticData.currentBatch = currentBatch + 1;
      return [batchItems, []];
    }
  },
});

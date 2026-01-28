import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const ManualTrigger = createProgrammaticNode({
  name: 'manualTrigger',
  displayName: 'Manual Trigger',
  description: 'Manually starts the workflow',
  icon: 'fa:play',
  group: ['trigger'],
  version: 1,
  defaults: {
    name: 'When clicking "Test workflow"',
  },
  inputs: [],
  outputs: ['main'],
  properties: [],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    return [[{ json: { triggeredAt: new Date().toISOString() } }]];
  },
});

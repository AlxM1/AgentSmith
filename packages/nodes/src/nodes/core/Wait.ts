import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Wait = createProgrammaticNode({
  name: 'wait',
  displayName: 'Wait',
  description: 'Wait for a specified amount of time',
  icon: 'fa:clock',
  group: ['flow'],
  version: 1,
  defaults: {
    name: 'Wait',
  },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resume',
      name: 'resume',
      type: 'options',
      options: [
        { name: 'After Time Interval', value: 'timeInterval' },
        { name: 'At Specific Time', value: 'specificTime' },
        { name: 'On Webhook Call', value: 'webhook' },
      ],
      default: 'timeInterval',
    },
    {
      displayName: 'Wait Amount',
      name: 'amount',
      type: 'number',
      displayOptions: {
        show: {
          resume: ['timeInterval'],
        },
      },
      default: 1,
    },
    {
      displayName: 'Wait Unit',
      name: 'unit',
      type: 'options',
      displayOptions: {
        show: {
          resume: ['timeInterval'],
        },
      },
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
        { name: 'Days', value: 'days' },
      ],
      default: 'seconds',
    },
    {
      displayName: 'Date and Time',
      name: 'dateTime',
      type: 'dateTime',
      displayOptions: {
        show: {
          resume: ['specificTime'],
        },
      },
      default: '',
    },
    {
      displayName: 'Limit Wait Time',
      name: 'limitWaitTime',
      type: 'boolean',
      displayOptions: {
        show: {
          resume: ['webhook'],
        },
      },
      default: false,
    },
    {
      displayName: 'Max Wait',
      name: 'maxWait',
      type: 'number',
      displayOptions: {
        show: {
          limitWaitTime: [true],
        },
      },
      default: 60,
      description: 'Maximum time to wait in minutes',
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const resume = this.getNodeParameter('resume', 0) as string;

    if (resume === 'timeInterval') {
      const amount = this.getNodeParameter('amount', 0) as number;
      const unit = this.getNodeParameter('unit', 0) as string;

      let waitMs = amount;
      switch (unit) {
        case 'seconds':
          waitMs = amount * 1000;
          break;
        case 'minutes':
          waitMs = amount * 60 * 1000;
          break;
        case 'hours':
          waitMs = amount * 60 * 60 * 1000;
          break;
        case 'days':
          waitMs = amount * 24 * 60 * 60 * 1000;
          break;
      }

      await new Promise(resolve => setTimeout(resolve, waitMs));
    } else if (resume === 'specificTime') {
      const dateTime = this.getNodeParameter('dateTime', 0) as string;
      const targetTime = new Date(dateTime).getTime();
      const now = Date.now();

      if (targetTime > now) {
        await new Promise(resolve => setTimeout(resolve, targetTime - now));
      }
    }
    // Webhook mode would be handled by the execution engine

    return [items];
  },
});

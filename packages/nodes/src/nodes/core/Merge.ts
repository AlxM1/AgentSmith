import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Merge = createProgrammaticNode({
  name: 'merge',
  displayName: 'Merge',
  description: 'Merge data from multiple inputs',
  icon: 'fa:code-merge',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Merge',
  },
  inputs: ['main', 'main'],
  inputNames: ['Input 1', 'Input 2'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        {
          name: 'Append',
          value: 'append',
          description: 'Combine all items from both inputs',
        },
        {
          name: 'Combine',
          value: 'combine',
          description: 'Merge items by position',
        },
        {
          name: 'Merge By Key',
          value: 'mergeByKey',
          description: 'Match items based on a key field',
        },
        {
          name: 'Keep Key Matches',
          value: 'keepKeyMatches',
          description: 'Only keep items that have a match',
        },
        {
          name: 'Multiplex',
          value: 'multiplex',
          description: 'Create all combinations of items',
        },
      ],
      default: 'append',
    },
    {
      displayName: 'Join Mode',
      name: 'joinMode',
      type: 'options',
      displayOptions: {
        show: {
          mode: ['mergeByKey', 'keepKeyMatches'],
        },
      },
      options: [
        { name: 'Inner Join', value: 'inner' },
        { name: 'Left Join', value: 'left' },
        { name: 'Right Join', value: 'right' },
        { name: 'Outer Join', value: 'outer' },
      ],
      default: 'inner',
    },
    {
      displayName: 'Property Input 1',
      name: 'propertyName1',
      type: 'string',
      displayOptions: {
        show: {
          mode: ['mergeByKey', 'keepKeyMatches'],
        },
      },
      default: 'id',
    },
    {
      displayName: 'Property Input 2',
      name: 'propertyName2',
      type: 'string',
      displayOptions: {
        show: {
          mode: ['mergeByKey', 'keepKeyMatches'],
        },
      },
      default: 'id',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Clash Handling',
          name: 'clashHandling',
          type: 'options',
          options: [
            { name: 'Prefer Input 1', value: 'preferInput1' },
            { name: 'Prefer Input 2', value: 'preferInput2' },
            { name: 'Add Suffix', value: 'addSuffix' },
          ],
          default: 'preferInput2',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const input1 = this.getInputData(0);
    const input2 = this.getInputData(1);
    const mode = this.getNodeParameter('mode', 0) as string;
    const options = this.getNodeParameter('options', 0, {}) as Record<string, any>;

    let returnData: INodeExecutionData[] = [];

    switch (mode) {
      case 'append':
        returnData = [...input1, ...input2];
        break;

      case 'combine': {
        const maxLength = Math.max(input1.length, input2.length);
        for (let i = 0; i < maxLength; i++) {
          const item1 = input1[i]?.json || {};
          const item2 = input2[i]?.json || {};
          returnData.push({
            json: { ...item1, ...item2 },
          });
        }
        break;
      }

      case 'mergeByKey':
      case 'keepKeyMatches': {
        const propertyName1 = this.getNodeParameter('propertyName1', 0) as string;
        const propertyName2 = this.getNodeParameter('propertyName2', 0) as string;
        const joinMode = this.getNodeParameter('joinMode', 0) as string;

        // Create lookup from input2
        const lookup = new Map<string, INodeExecutionData[]>();
        for (const item of input2) {
          const key = String(item.json[propertyName2] ?? '');
          if (!lookup.has(key)) {
            lookup.set(key, []);
          }
          lookup.get(key)!.push(item);
        }

        const matchedKeys = new Set<string>();

        // Process input1
        for (const item1 of input1) {
          const key = String(item1.json[propertyName1] ?? '');
          const matches = lookup.get(key);

          if (matches && matches.length > 0) {
            matchedKeys.add(key);
            for (const item2 of matches) {
              returnData.push({
                json: { ...item1.json, ...item2.json },
              });
            }
          } else if (joinMode === 'left' || joinMode === 'outer') {
            returnData.push({ json: { ...item1.json } });
          }
        }

        // Add unmatched from input2 for right/outer joins
        if (joinMode === 'right' || joinMode === 'outer') {
          for (const item2 of input2) {
            const key = String(item2.json[propertyName2] ?? '');
            if (!matchedKeys.has(key)) {
              returnData.push({ json: { ...item2.json } });
            }
          }
        }
        break;
      }

      case 'multiplex': {
        for (const item1 of input1) {
          for (const item2 of input2) {
            returnData.push({
              json: { ...item1.json, ...item2.json },
            });
          }
        }
        break;
      }
    }

    return [returnData];
  },
});

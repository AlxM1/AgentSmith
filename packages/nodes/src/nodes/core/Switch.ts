import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Switch = createProgrammaticNode({
  name: 'switch',
  displayName: 'Switch',
  description: 'Route items to different outputs based on rules',
  icon: 'fa:random',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Switch',
  },
  inputs: ['main'],
  outputs: ['main', 'main', 'main', 'main'],
  outputNames: ['Output 0', 'Output 1', 'Output 2', 'Output 3'],
  properties: [
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Rules', value: 'rules' },
        { name: 'Expression', value: 'expression' },
      ],
      default: 'rules',
    },
    {
      displayName: 'Routing Rules',
      name: 'rules',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      displayOptions: {
        show: {
          mode: ['rules'],
        },
      },
      default: {},
      options: [
        {
          name: 'rules',
          displayName: 'Rule',
          values: [
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Operation',
              name: 'operation',
              type: 'options',
              options: [
                { name: 'Equals', value: 'equal' },
                { name: 'Not Equals', value: 'notEqual' },
                { name: 'Contains', value: 'contains' },
                { name: 'Regex', value: 'regex' },
              ],
              default: 'equal',
            },
            {
              displayName: 'Value 2',
              name: 'value2',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Output',
              name: 'output',
              type: 'number',
              default: 0,
              description: 'Output index (0-3)',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Output',
      name: 'output',
      type: 'string',
      displayOptions: {
        show: {
          mode: ['expression'],
        },
      },
      default: '={{ 0 }}',
      description: 'Expression that returns the output index (0-3)',
    },
    {
      displayName: 'Fallback Output',
      name: 'fallbackOutput',
      type: 'options',
      options: [
        { name: 'Output 0', value: 0 },
        { name: 'Output 1', value: 1 },
        { name: 'Output 2', value: 2 },
        { name: 'Output 3', value: 3 },
        { name: 'None (Discard)', value: -1 },
      ],
      default: -1,
      description: 'Where to send items that don\'t match any rule',
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const mode = this.getNodeParameter('mode', 0) as string;
    const fallbackOutput = this.getNodeParameter('fallbackOutput', 0) as number;

    const outputs: INodeExecutionData[][] = [[], [], [], []];

    for (let i = 0; i < items.length; i++) {
      let outputIndex = fallbackOutput;

      if (mode === 'rules') {
        const rules = this.getNodeParameter('rules.rules', i, []) as Array<{
          value: any;
          operation: string;
          value2: any;
          output: number;
        }>;

        for (const rule of rules) {
          let matched = false;

          switch (rule.operation) {
            case 'equal':
              matched = rule.value == rule.value2;
              break;
            case 'notEqual':
              matched = rule.value != rule.value2;
              break;
            case 'contains':
              matched = String(rule.value).includes(String(rule.value2));
              break;
            case 'regex':
              try {
                matched = new RegExp(String(rule.value2)).test(String(rule.value));
              } catch {
                matched = false;
              }
              break;
          }

          if (matched) {
            outputIndex = rule.output;
            break;
          }
        }
      } else {
        // Expression mode
        const output = this.getNodeParameter('output', i) as number;
        outputIndex = Math.min(3, Math.max(0, Math.floor(output)));
      }

      if (outputIndex >= 0 && outputIndex <= 3) {
        outputs[outputIndex].push({
          ...items[i],
          pairedItem: { item: i },
        });
      }
    }

    return outputs;
  },
});

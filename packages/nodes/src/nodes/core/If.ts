import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const If = createProgrammaticNode({
  name: 'if',
  displayName: 'If',
  description: 'Route items based on conditions',
  icon: 'fa:code-branch',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'If',
  },
  inputs: ['main'],
  outputs: ['main', 'main'],
  outputNames: ['true', 'false'],
  properties: [
    {
      displayName: 'Conditions',
      name: 'conditions',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      default: {},
      options: [
        {
          name: 'conditions',
          displayName: 'Condition',
          values: [
            {
              displayName: 'Value 1',
              name: 'value1',
              type: 'string',
              default: '',
              description: 'The first value to compare (supports expressions)',
            },
            {
              displayName: 'Operation',
              name: 'operation',
              type: 'options',
              options: [
                { name: 'Equals', value: 'equal' },
                { name: 'Not Equals', value: 'notEqual' },
                { name: 'Greater Than', value: 'larger' },
                { name: 'Less Than', value: 'smaller' },
                { name: 'Greater Than or Equal', value: 'largerEqual' },
                { name: 'Less Than or Equal', value: 'smallerEqual' },
                { name: 'Contains', value: 'contains' },
                { name: 'Not Contains', value: 'notContains' },
                { name: 'Starts With', value: 'startsWith' },
                { name: 'Ends With', value: 'endsWith' },
                { name: 'Is Empty', value: 'isEmpty' },
                { name: 'Is Not Empty', value: 'isNotEmpty' },
                { name: 'Regex', value: 'regex' },
              ],
              default: 'equal',
            },
            {
              displayName: 'Value 2',
              name: 'value2',
              type: 'string',
              default: '',
              displayOptions: {
                hide: {
                  operation: ['isEmpty', 'isNotEmpty'],
                },
              },
            },
          ],
        },
      ],
    },
    {
      displayName: 'Combine Conditions',
      name: 'combineOperation',
      type: 'options',
      options: [
        { name: 'AND', value: 'and' },
        { name: 'OR', value: 'or' },
      ],
      default: 'and',
      description: 'How to combine multiple conditions',
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const trueItems: INodeExecutionData[] = [];
    const falseItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const conditions = this.getNodeParameter('conditions.conditions', i, []) as Array<{
        value1: any;
        operation: string;
        value2: any;
      }>;
      const combineOperation = this.getNodeParameter('combineOperation', i) as string;

      const results: boolean[] = [];

      for (const condition of conditions) {
        const { value1, operation, value2 } = condition;
        let result = false;

        switch (operation) {
          case 'equal':
            result = value1 == value2;
            break;
          case 'notEqual':
            result = value1 != value2;
            break;
          case 'larger':
            result = Number(value1) > Number(value2);
            break;
          case 'smaller':
            result = Number(value1) < Number(value2);
            break;
          case 'largerEqual':
            result = Number(value1) >= Number(value2);
            break;
          case 'smallerEqual':
            result = Number(value1) <= Number(value2);
            break;
          case 'contains':
            result = String(value1).includes(String(value2));
            break;
          case 'notContains':
            result = !String(value1).includes(String(value2));
            break;
          case 'startsWith':
            result = String(value1).startsWith(String(value2));
            break;
          case 'endsWith':
            result = String(value1).endsWith(String(value2));
            break;
          case 'isEmpty':
            result = value1 === '' || value1 === null || value1 === undefined;
            break;
          case 'isNotEmpty':
            result = value1 !== '' && value1 !== null && value1 !== undefined;
            break;
          case 'regex':
            try {
              const regex = new RegExp(String(value2));
              result = regex.test(String(value1));
            } catch {
              result = false;
            }
            break;
        }

        results.push(result);
      }

      let finalResult: boolean;
      if (results.length === 0) {
        finalResult = false;
      } else if (combineOperation === 'and') {
        finalResult = results.every(r => r);
      } else {
        finalResult = results.some(r => r);
      }

      if (finalResult) {
        trueItems.push({ ...items[i], pairedItem: { item: i } });
      } else {
        falseItems.push({ ...items[i], pairedItem: { item: i } });
      }
    }

    return [trueItems, falseItems];
  },
});

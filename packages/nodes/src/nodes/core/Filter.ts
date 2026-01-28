import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Filter = createProgrammaticNode({
  name: 'filter',
  displayName: 'Filter',
  description: 'Filter items based on conditions',
  icon: 'fa:filter',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Filter',
  },
  inputs: ['main'],
  outputs: ['main'],
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
                { name: 'Is True', value: 'isTrue' },
                { name: 'Is False', value: 'isFalse' },
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
                  operation: ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'],
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
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

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
          case 'isTrue':
            result = value1 === true || value1 === 'true' || value1 === 1;
            break;
          case 'isFalse':
            result = value1 === false || value1 === 'false' || value1 === 0;
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

      let passes: boolean;
      if (results.length === 0) {
        passes = true; // No conditions = pass all
      } else if (combineOperation === 'and') {
        passes = results.every(r => r);
      } else {
        passes = results.some(r => r);
      }

      if (passes) {
        returnData.push({ ...items[i], pairedItem: { item: i } });
      }
    }

    return [returnData];
  },
});

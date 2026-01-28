import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Set = createProgrammaticNode({
  name: 'set',
  displayName: 'Set',
  description: 'Set values on items',
  icon: 'fa:pen',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Set',
  },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Manual Mapping', value: 'manual' },
        { name: 'JSON', value: 'json' },
      ],
      default: 'manual',
    },
    {
      displayName: 'Keep Only Set',
      name: 'keepOnlySet',
      type: 'boolean',
      default: false,
      description: 'If true, only the set values will be kept',
    },
    {
      displayName: 'Values',
      name: 'values',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      displayOptions: {
        show: {
          mode: ['manual'],
        },
      },
      default: {},
      options: [
        {
          name: 'string',
          displayName: 'String',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
              placeholder: 'propertyName',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
        {
          name: 'number',
          displayName: 'Number',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
              placeholder: 'propertyName',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'number',
              default: 0,
            },
          ],
        },
        {
          name: 'boolean',
          displayName: 'Boolean',
          values: [
            {
              displayName: 'Name',
              name: 'name',
              type: 'string',
              default: '',
              placeholder: 'propertyName',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'boolean',
              default: false,
            },
          ],
        },
      ],
    },
    {
      displayName: 'JSON',
      name: 'jsonData',
      type: 'json',
      displayOptions: {
        show: {
          mode: ['json'],
        },
      },
      default: '{}',
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const mode = this.getNodeParameter('mode', 0) as string;
    const keepOnlySet = this.getNodeParameter('keepOnlySet', 0) as boolean;

    for (let i = 0; i < items.length; i++) {
      let newItem: Record<string, any> = keepOnlySet ? {} : { ...items[i].json };

      if (mode === 'manual') {
        const values = this.getNodeParameter('values', i, {}) as Record<string, Array<{ name: string; value: any }>>;

        for (const type of ['string', 'number', 'boolean']) {
          if (values[type]) {
            for (const entry of values[type]) {
              if (entry.name) {
                // Support dot notation for nested properties
                const keys = entry.name.split('.');
                let target = newItem;
                for (let j = 0; j < keys.length - 1; j++) {
                  if (!(keys[j] in target)) {
                    target[keys[j]] = {};
                  }
                  target = target[keys[j]];
                }
                target[keys[keys.length - 1]] = entry.value;
              }
            }
          }
        }
      } else {
        // JSON mode
        const jsonData = this.getNodeParameter('jsonData', i) as string;
        try {
          const parsed = JSON.parse(jsonData);
          if (keepOnlySet) {
            newItem = parsed;
          } else {
            newItem = { ...newItem, ...parsed };
          }
        } catch (error: any) {
          if (this.continueOnFail()) {
            returnData.push({
              json: { error: `Invalid JSON: ${error.message}` },
              pairedItem: { item: i },
            });
            continue;
          }
          throw error;
        }
      }

      returnData.push({
        json: newItem,
        binary: items[i].binary,
        pairedItem: { item: i },
      });
    }

    return [returnData];
  },
});

import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';
import { VM } from 'vm2';

export const Code = createProgrammaticNode({
  name: 'code',
  displayName: 'Code',
  description: 'Execute custom JavaScript code',
  icon: 'fa:code',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Code',
  },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
        { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
      ],
      default: 'runOnceForAllItems',
    },
    {
      displayName: 'JavaScript Code',
      name: 'jsCode',
      type: 'string',
      typeOptions: {
        rows: 10,
        editor: 'code',
        editorLanguage: 'javascript',
      },
      default: `// For "Run Once for All Items":
// Return an array of items
return items.map(item => {
  return {
    json: {
      ...item.json,
      processed: true,
    }
  };
});

// For "Run Once for Each Item":
// Return a single item
// return { json: { ...item.json, processed: true } };
`,
      description: 'The JavaScript code to execute',
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const mode = this.getNodeParameter('mode', 0) as string;
    const jsCode = this.getNodeParameter('jsCode', 0) as string;

    let returnData: INodeExecutionData[] = [];

    const vm = new VM({
      timeout: 10000,
      sandbox: {
        console: {
          log: (...args: any[]) => console.log('[Code Node]:', ...args),
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
      },
    });

    try {
      if (mode === 'runOnceForAllItems') {
        // Run once with all items
        vm.setGlobal('items', items);
        vm.setGlobal('$input', { all: () => items, first: () => items[0] });

        const wrappedCode = `
          (function() {
            ${jsCode}
          })();
        `;

        const result = vm.run(wrappedCode);

        if (Array.isArray(result)) {
          returnData = result.map((item: any) => {
            if (item.json !== undefined) return item;
            return { json: item };
          });
        } else if (result !== undefined) {
          returnData = [{ json: result }];
        }
      } else {
        // Run once for each item
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          vm.setGlobal('item', item);
          vm.setGlobal('$json', item.json);
          vm.setGlobal('$binary', item.binary);
          vm.setGlobal('$itemIndex', i);

          const wrappedCode = `
            (function() {
              ${jsCode}
            })();
          `;

          const result = vm.run(wrappedCode);

          if (Array.isArray(result)) {
            returnData.push(...result.map((r: any) => {
              if (r.json !== undefined) return r;
              return { json: r };
            }));
          } else if (result !== undefined) {
            if (result.json !== undefined) {
              returnData.push(result);
            } else {
              returnData.push({ json: result });
            }
          }
        }
      }
    } catch (error: any) {
      if (this.continueOnFail()) {
        return [[{ json: { error: error.message } }]];
      }
      throw error;
    }

    return [returnData];
  },
});

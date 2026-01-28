import { createProgrammaticNode } from '@agentsmith/shared';

export const JSON_Node = createProgrammaticNode({
  name: 'JSON',
  displayName: 'JSON',
  description: 'Parse, stringify, and manipulate JSON data',
  icon: 'fa:code',
  group: ['transform'],
  version: 1,
  defaults: { name: 'JSON' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Parse JSON String', value: 'parse' },
        { name: 'Stringify to JSON', value: 'stringify' },
        { name: 'Convert to Array', value: 'toArray' },
        { name: 'Flatten', value: 'flatten' },
        { name: 'Unflatten', value: 'unflatten' },
        { name: 'Get Value', value: 'getValue' },
        { name: 'Set Value', value: 'setValue' },
        { name: 'Delete Key', value: 'deleteKey' },
        { name: 'Minify', value: 'minify' },
        { name: 'Pretty Print', value: 'prettify' },
      ],
      default: 'parse',
    },
    {
      displayName: 'JSON String',
      name: 'jsonString',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['parse', 'minify', 'prettify'] } },
    },
    {
      displayName: 'Source Data',
      name: 'sourceData',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['stringify', 'toArray', 'flatten', 'unflatten', 'getValue', 'setValue', 'deleteKey'] } },
      description: 'Field name or expression for source data',
    },
    {
      displayName: 'JSON Path',
      name: 'jsonPath',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getValue', 'setValue', 'deleteKey'] } },
      description: 'Dot notation path (e.g., user.name.first)',
    },
    {
      displayName: 'New Value',
      name: 'newValue',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['setValue'] } },
    },
    {
      displayName: 'Separator',
      name: 'separator',
      type: 'string',
      default: '.',
      displayOptions: { show: { operation: ['flatten', 'unflatten'] } },
    },
    {
      displayName: 'Indent',
      name: 'indent',
      type: 'number',
      default: 2,
      displayOptions: { show: { operation: ['prettify', 'stringify'] } },
    },
    {
      displayName: 'Output Field Name',
      name: 'outputFieldName',
      type: 'string',
      default: 'data',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const outputFieldName = this.getNodeParameter('outputFieldName', i) as string;
      let result: any;

      try {
        switch (operation) {
          case 'parse': {
            const jsonString = this.getNodeParameter('jsonString', i) as string;
            result = JSON.parse(jsonString);
            break;
          }

          case 'stringify': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const indent = this.getNodeParameter('indent', i) as number;
            const data = getNestedValue(items[i].json, sourceData) || items[i].json;
            result = JSON.stringify(data, null, indent);
            break;
          }

          case 'toArray': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const data = getNestedValue(items[i].json, sourceData) || items[i].json;
            if (Array.isArray(data)) {
              result = data;
            } else if (typeof data === 'object') {
              result = Object.entries(data).map(([key, value]) => ({ key, value }));
            } else {
              result = [data];
            }
            break;
          }

          case 'flatten': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const separator = this.getNodeParameter('separator', i) as string;
            const data = getNestedValue(items[i].json, sourceData) || items[i].json;
            result = flattenObject(data, '', separator);
            break;
          }

          case 'unflatten': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const separator = this.getNodeParameter('separator', i) as string;
            const data = getNestedValue(items[i].json, sourceData) || items[i].json;
            result = unflattenObject(data, separator);
            break;
          }

          case 'getValue': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const jsonPath = this.getNodeParameter('jsonPath', i) as string;
            const data = sourceData ? getNestedValue(items[i].json, sourceData) : items[i].json;
            result = getNestedValue(data, jsonPath);
            break;
          }

          case 'setValue': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const jsonPath = this.getNodeParameter('jsonPath', i) as string;
            const newValue = this.getNodeParameter('newValue', i) as string;
            const data = JSON.parse(JSON.stringify(sourceData ? getNestedValue(items[i].json, sourceData) : items[i].json));
            setNestedValue(data, jsonPath, tryParseJSON(newValue));
            result = data;
            break;
          }

          case 'deleteKey': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const jsonPath = this.getNodeParameter('jsonPath', i) as string;
            const data = JSON.parse(JSON.stringify(sourceData ? getNestedValue(items[i].json, sourceData) : items[i].json));
            deleteNestedValue(data, jsonPath);
            result = data;
            break;
          }

          case 'minify': {
            const jsonString = this.getNodeParameter('jsonString', i) as string;
            result = JSON.stringify(JSON.parse(jsonString));
            break;
          }

          case 'prettify': {
            const jsonString = this.getNodeParameter('jsonString', i) as string;
            const indent = this.getNodeParameter('indent', i) as number;
            result = JSON.stringify(JSON.parse(jsonString), null, indent);
            break;
          }
        }

        returnData.push({
          json: {
            ...items[i].json,
            [outputFieldName]: result,
          },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((acc, key) => {
    if (!(key in acc)) acc[key] = {};
    return acc[key];
  }, obj);
  target[lastKey] = value;
}

function deleteNestedValue(obj: any, path: string): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((acc, key) => acc?.[key], obj);
  if (target) delete target[lastKey];
}

function flattenObject(obj: any, prefix: string, separator: string): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey, separator));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

function unflattenObject(obj: Record<string, any>, separator: string): any {
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split(separator);
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
}

function tryParseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

import { createProgrammaticNode } from '@agentsmith/shared';

export const Spreadsheet = createProgrammaticNode({
  name: 'Spreadsheet',
  displayName: 'Spreadsheet File',
  description: 'Read and write spreadsheet files (CSV, Excel)',
  icon: 'fa:file-excel',
  group: ['data'],
  version: 1,
  defaults: { name: 'Spreadsheet' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Read from File', value: 'read' },
        { name: 'Write to File', value: 'write' },
        { name: 'Convert Format', value: 'convert' },
      ],
      default: 'read',
    },
    {
      displayName: 'File Format',
      name: 'fileFormat',
      type: 'options',
      options: [
        { name: 'CSV', value: 'csv' },
        { name: 'TSV', value: 'tsv' },
        { name: 'Excel (.xlsx)', value: 'xlsx' },
        { name: 'Auto-Detect', value: 'auto' },
      ],
      default: 'auto',
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['read', 'convert'] } },
    },
    {
      displayName: 'Output Binary Property',
      name: 'outputBinaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['write', 'convert'] } },
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'CSV', value: 'csv' },
        { name: 'TSV', value: 'tsv' },
        { name: 'JSON', value: 'json' },
      ],
      default: 'csv',
      displayOptions: { show: { operation: ['write', 'convert'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Has Header Row',
          name: 'hasHeaderRow',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Delimiter',
          name: 'delimiter',
          type: 'string',
          default: ',',
          description: 'Character used to separate columns (for CSV)',
        },
        {
          displayName: 'Sheet Name / Index',
          name: 'sheetName',
          type: 'string',
          default: '0',
          description: 'Sheet name or index (0-based) for Excel files',
        },
        {
          displayName: 'Range',
          name: 'range',
          type: 'string',
          default: '',
          description: 'Cell range to read (e.g., A1:D10)',
        },
        {
          displayName: 'Skip Empty Rows',
          name: 'skipEmptyRows',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Empty Cells',
          name: 'includeEmptyCells',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const fileFormat = this.getNodeParameter('fileFormat', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        if (operation === 'read') {
          const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
          const binaryData = items[i].binary?.[binaryProperty];

          if (!binaryData) {
            throw new Error(`No binary data found in property "${binaryProperty}"`);
          }

          const content = Buffer.from(binaryData.data, 'base64').toString('utf-8');
          const format = fileFormat === 'auto' ? detectFormat(binaryData.fileName || '') : fileFormat;
          const rows = parseSpreadsheet(content, format, options);

          for (const row of rows) {
            returnData.push({ json: row });
          }
        } else if (operation === 'write') {
          const outputFormat = this.getNodeParameter('outputFormat', i) as string;
          const outputBinaryProperty = this.getNodeParameter('outputBinaryProperty', i) as string;

          const data = items.map(item => item.json);
          const content = generateSpreadsheet(data, outputFormat, options);

          const mimeTypes: Record<string, string> = {
            csv: 'text/csv',
            tsv: 'text/tab-separated-values',
            json: 'application/json',
          };

          returnData.push({
            json: items[i].json,
            binary: {
              [outputBinaryProperty]: {
                data: Buffer.from(content).toString('base64'),
                mimeType: mimeTypes[outputFormat],
                fileName: `output.${outputFormat}`,
              },
            },
          });
        } else if (operation === 'convert') {
          const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
          const outputFormat = this.getNodeParameter('outputFormat', i) as string;
          const outputBinaryProperty = this.getNodeParameter('outputBinaryProperty', i) as string;

          const binaryData = items[i].binary?.[binaryProperty];
          if (!binaryData) throw new Error(`No binary data found`);

          const content = Buffer.from(binaryData.data, 'base64').toString('utf-8');
          const format = fileFormat === 'auto' ? detectFormat(binaryData.fileName || '') : fileFormat;
          const rows = parseSpreadsheet(content, format, options);
          const output = generateSpreadsheet(rows, outputFormat, options);

          const mimeTypes: Record<string, string> = {
            csv: 'text/csv',
            tsv: 'text/tab-separated-values',
            json: 'application/json',
          };

          returnData.push({
            json: { rowCount: rows.length },
            binary: {
              [outputBinaryProperty]: {
                data: Buffer.from(output).toString('base64'),
                mimeType: mimeTypes[outputFormat],
                fileName: `output.${outputFormat}`,
              },
            },
          });
        }
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

export const Aggregate = createProgrammaticNode({
  name: 'Aggregate',
  displayName: 'Aggregate',
  description: 'Aggregate and summarize data from multiple items',
  icon: 'fa:layer-group',
  group: ['data'],
  version: 1,
  defaults: { name: 'Aggregate' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Aggregate',
      name: 'aggregate',
      type: 'options',
      options: [
        { name: 'Individual Fields', value: 'individualFields' },
        { name: 'All Item Data', value: 'allItemData' },
      ],
      default: 'individualFields',
    },
    {
      displayName: 'Fields to Aggregate',
      name: 'fieldsToAggregate',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { aggregate: ['individualFields'] } },
      options: [
        {
          displayName: 'Field',
          name: 'field',
          values: [
            { displayName: 'Input Field', name: 'inputField', type: 'string', default: '' },
            { displayName: 'Output Field', name: 'outputField', type: 'string', default: '' },
            {
              displayName: 'Aggregation',
              name: 'aggregation',
              type: 'options',
              options: [
                { name: 'Append (Array)', value: 'append' },
                { name: 'Concatenate (String)', value: 'concatenate' },
                { name: 'Sum', value: 'sum' },
                { name: 'Average', value: 'average' },
                { name: 'Min', value: 'min' },
                { name: 'Max', value: 'max' },
                { name: 'Count', value: 'count' },
                { name: 'Count Unique', value: 'countUnique' },
                { name: 'First', value: 'first' },
                { name: 'Last', value: 'last' },
              ],
              default: 'append',
            },
            {
              displayName: 'Separator',
              name: 'separator',
              type: 'string',
              default: ', ',
              displayOptions: { show: { aggregation: ['concatenate'] } },
            },
          ],
        },
      ],
    },
    {
      displayName: 'Include',
      name: 'include',
      type: 'options',
      options: [
        { name: 'All Fields', value: 'allFields' },
        { name: 'Specified Fields', value: 'specifiedFields' },
        { name: 'All Fields Except', value: 'allFieldsExcept' },
      ],
      default: 'allFields',
      displayOptions: { show: { aggregate: ['allItemData'] } },
    },
    {
      displayName: 'Fields',
      name: 'fields',
      type: 'string',
      default: '',
      displayOptions: { show: { aggregate: ['allItemData'], include: ['specifiedFields', 'allFieldsExcept'] } },
      description: 'Comma-separated list of fields',
    },
    {
      displayName: 'Output Field Name',
      name: 'outputFieldName',
      type: 'string',
      default: 'data',
      displayOptions: { show: { aggregate: ['allItemData'] } },
    },
  ],
  execute: async function () {
    const items = this.getInputData();

    if (items.length === 0) {
      return [[]];
    }

    const aggregate = this.getNodeParameter('aggregate', 0) as string;

    if (aggregate === 'allItemData') {
      const include = this.getNodeParameter('include', 0) as string;
      const outputFieldName = this.getNodeParameter('outputFieldName', 0) as string;
      const fieldsStr = this.getNodeParameter('fields', 0) as string;
      const fields = fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : [];

      let data = items.map(item => {
        if (include === 'allFields') {
          return item.json;
        } else if (include === 'specifiedFields') {
          const result: Record<string, any> = {};
          for (const field of fields) {
            if (field in item.json) {
              result[field] = item.json[field];
            }
          }
          return result;
        } else {
          const result: Record<string, any> = { ...item.json };
          for (const field of fields) {
            delete result[field];
          }
          return result;
        }
      });

      return [[{ json: { [outputFieldName]: data } }]];
    } else {
      const fieldsToAggregate = this.getNodeParameter('fieldsToAggregate', 0) as any;
      const result: Record<string, any> = {};

      for (const fieldConfig of fieldsToAggregate.field || []) {
        const { inputField, outputField, aggregation, separator } = fieldConfig;
        const values = items.map(item => getNestedValue(item.json, inputField));

        result[outputField || inputField] = aggregateValues(values, aggregation, separator);
      }

      return [[{ json: result }]];
    }
  },
});

export const Sort = createProgrammaticNode({
  name: 'Sort',
  displayName: 'Sort',
  description: 'Sort items based on field values',
  icon: 'fa:sort',
  group: ['data'],
  version: 1,
  defaults: { name: 'Sort' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Sort By',
      name: 'sortBy',
      type: 'options',
      options: [
        { name: 'Field Value', value: 'fieldValue' },
        { name: 'Random', value: 'random' },
        { name: 'Code', value: 'code' },
      ],
      default: 'fieldValue',
    },
    {
      displayName: 'Fields to Sort By',
      name: 'sortFields',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { sortBy: ['fieldValue'] } },
      options: [
        {
          displayName: 'Field',
          name: 'field',
          values: [
            { displayName: 'Field Name', name: 'fieldName', type: 'string', default: '' },
            {
              displayName: 'Order',
              name: 'order',
              type: 'options',
              options: [
                { name: 'Ascending', value: 'asc' },
                { name: 'Descending', value: 'desc' },
              ],
              default: 'asc',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Sort Code',
      name: 'sortCode',
      type: 'string',
      typeOptions: { rows: 5 },
      default: 'return a.json.field - b.json.field;',
      displayOptions: { show: { sortBy: ['code'] } },
      description: 'Custom sort function. Use a and b to access items.',
    },
  ],
  execute: async function () {
    const items = [...this.getInputData()];
    const sortBy = this.getNodeParameter('sortBy', 0) as string;

    if (sortBy === 'random') {
      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    } else if (sortBy === 'code') {
      const sortCode = this.getNodeParameter('sortCode', 0) as string;
      const sortFn = new Function('a', 'b', sortCode);
      items.sort((a, b) => sortFn(a, b));
    } else {
      const sortFields = this.getNodeParameter('sortFields', 0) as any;

      items.sort((a, b) => {
        for (const field of sortFields.field || []) {
          const { fieldName, order } = field;
          const aVal = getNestedValue(a.json, fieldName);
          const bVal = getNestedValue(b.json, fieldName);

          let comparison = 0;
          if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;

          if (comparison !== 0) {
            return order === 'desc' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    return [items];
  },
});

export const Limit = createProgrammaticNode({
  name: 'Limit',
  displayName: 'Limit',
  description: 'Limit the number of items',
  icon: 'fa:hand-paper',
  group: ['data'],
  version: 1,
  defaults: { name: 'Limit' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Max Items',
      name: 'maxItems',
      type: 'number',
      default: 10,
    },
    {
      displayName: 'Keep',
      name: 'keep',
      type: 'options',
      options: [
        { name: 'First Items', value: 'first' },
        { name: 'Last Items', value: 'last' },
      ],
      default: 'first',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const maxItems = this.getNodeParameter('maxItems', 0) as number;
    const keep = this.getNodeParameter('keep', 0) as string;

    if (keep === 'first') {
      return [items.slice(0, maxItems)];
    } else {
      return [items.slice(-maxItems)];
    }
  },
});

export const RemoveDuplicates = createProgrammaticNode({
  name: 'RemoveDuplicates',
  displayName: 'Remove Duplicates',
  description: 'Remove duplicate items based on field values',
  icon: 'fa:clone',
  group: ['data'],
  version: 1,
  defaults: { name: 'Remove Duplicates' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Compare',
      name: 'compare',
      type: 'options',
      options: [
        { name: 'All Fields', value: 'allFields' },
        { name: 'Specific Fields', value: 'specificFields' },
      ],
      default: 'allFields',
    },
    {
      displayName: 'Fields to Compare',
      name: 'fieldsToCompare',
      type: 'string',
      default: '',
      displayOptions: { show: { compare: ['specificFields'] } },
      description: 'Comma-separated list of fields',
    },
    {
      displayName: 'Keep',
      name: 'keep',
      type: 'options',
      options: [
        { name: 'First Occurrence', value: 'first' },
        { name: 'Last Occurrence', value: 'last' },
      ],
      default: 'first',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const compare = this.getNodeParameter('compare', 0) as string;
    const keep = this.getNodeParameter('keep', 0) as string;
    const fieldsStr = this.getNodeParameter('fieldsToCompare', 0) as string;
    const fields = fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : [];

    const seen = new Map<string, number>();
    const result: any[] = [];

    const getKey = (item: any) => {
      if (compare === 'allFields') {
        return JSON.stringify(item.json);
      } else {
        const obj: Record<string, any> = {};
        for (const field of fields) {
          obj[field] = getNestedValue(item.json, field);
        }
        return JSON.stringify(obj);
      }
    };

    for (let i = 0; i < items.length; i++) {
      const key = getKey(items[i]);

      if (keep === 'first') {
        if (!seen.has(key)) {
          seen.set(key, i);
          result.push(items[i]);
        }
      } else {
        seen.set(key, i);
      }
    }

    if (keep === 'last') {
      const indices = Array.from(seen.values()).sort((a, b) => a - b);
      for (const idx of indices) {
        result.push(items[idx]);
      }
    }

    return [result];
  },
});

export const RenameKeys = createProgrammaticNode({
  name: 'RenameKeys',
  displayName: 'Rename Keys',
  description: 'Rename field keys in items',
  icon: 'fa:i-cursor',
  group: ['data'],
  version: 1,
  defaults: { name: 'Rename Keys' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Keys to Rename',
      name: 'keysToRename',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [
        {
          displayName: 'Key',
          name: 'key',
          values: [
            { displayName: 'Current Name', name: 'currentName', type: 'string', default: '' },
            { displayName: 'New Name', name: 'newName', type: 'string', default: '' },
          ],
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const keysToRename = this.getNodeParameter('keysToRename', 0) as any;
    const returnData: any[] = [];

    const renameMap = new Map<string, string>();
    for (const key of keysToRename.key || []) {
      renameMap.set(key.currentName, key.newName);
    }

    for (const item of items) {
      const newJson: Record<string, any> = {};

      for (const [key, value] of Object.entries(item.json)) {
        const newKey = renameMap.get(key) || key;
        newJson[newKey] = value;
      }

      returnData.push({ json: newJson, binary: item.binary });
    }

    return [returnData];
  },
});

// Helper functions
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function aggregateValues(values: any[], aggregation: string, separator?: string): any {
  switch (aggregation) {
    case 'append':
      return values;
    case 'concatenate':
      return values.join(separator || ', ');
    case 'sum':
      return values.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
    case 'average':
      const nums = values.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'min':
      return Math.min(...values.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number));
    case 'max':
      return Math.max(...values.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number));
    case 'count':
      return values.length;
    case 'countUnique':
      return new Set(values).size;
    case 'first':
      return values[0];
    case 'last':
      return values[values.length - 1];
    default:
      return values;
  }
}

function detectFormat(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'csv';
}

function parseSpreadsheet(content: string, format: string, options: any): Record<string, any>[] {
  const delimiter = format === 'tsv' ? '\t' : (options.delimiter || ',');
  const lines = content.split(/\r?\n/).filter(line => !options.skipEmptyRows || line.trim());

  if (lines.length === 0) return [];

  const hasHeader = options.hasHeaderRow !== false;
  let headers: string[];

  if (hasHeader) {
    headers = parseCSVLine(lines[0], delimiter);
    lines.shift();
  } else {
    const firstLine = parseCSVLine(lines[0], delimiter);
    headers = firstLine.map((_, i) => `column${i + 1}`);
  }

  return lines.map(line => {
    const values = parseCSVLine(line, delimiter);
    const row: Record<string, any> = {};

    headers.forEach((header, i) => {
      if (values[i] !== undefined || options.includeEmptyCells) {
        row[header] = values[i] ?? '';
      }
    });

    return row;
  });
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

function generateSpreadsheet(data: Record<string, any>[], format: string, options: any): string {
  if (data.length === 0) return '';

  const delimiter = format === 'tsv' ? '\t' : (options.delimiter || ',');

  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  const headers = Object.keys(data[0]);
  const lines: string[] = [];

  if (options.hasHeaderRow !== false) {
    lines.push(headers.map(h => escapeCSVField(h, delimiter)).join(delimiter));
  }

  for (const row of data) {
    const values = headers.map(h => escapeCSVField(String(row[h] ?? ''), delimiter));
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

function escapeCSVField(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

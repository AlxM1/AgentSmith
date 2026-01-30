/**
 * Data Processing Nodes
 * CSV, Excel, PDF, Image processing and data transformation
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../types/nodes.js';

// CSV Parser Node
export const csvParserNode: NodeDefinition = {
  name: 'CSV Parser',
  type: 'csvParser',
  category: 'data',
  description: 'Parse CSV data into JSON objects',
  icon: 'file-spreadsheet',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      options: [
        { name: 'Parse CSV to JSON', value: 'parse' },
        { name: 'Convert JSON to CSV', value: 'stringify' },
      ],
      default: 'parse',
    },
    {
      name: 'inputField',
      displayName: 'Input Field',
      type: 'string',
      default: 'data',
      description: 'Field containing CSV/JSON data',
    },
    {
      name: 'outputField',
      displayName: 'Output Field',
      type: 'string',
      default: 'data',
      description: 'Field to store the result',
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'delimiter',
          displayName: 'Delimiter',
          type: 'string',
          default: ',',
          description: 'Field delimiter character',
        },
        {
          name: 'header',
          displayName: 'Has Header Row',
          type: 'boolean',
          default: true,
        },
        {
          name: 'skipEmptyLines',
          displayName: 'Skip Empty Lines',
          type: 'boolean',
          default: true,
        },
        {
          name: 'trimFields',
          displayName: 'Trim Fields',
          type: 'boolean',
          default: true,
        },
        {
          name: 'quote',
          displayName: 'Quote Character',
          type: 'string',
          default: '"',
        },
        {
          name: 'escape',
          displayName: 'Escape Character',
          type: 'string',
          default: '"',
        },
        {
          name: 'columns',
          displayName: 'Custom Column Names',
          type: 'string',
          default: '',
          description: 'Comma-separated column names (overrides header)',
        },
        {
          name: 'maxRows',
          displayName: 'Max Rows',
          type: 'number',
          default: 0,
          description: 'Maximum rows to process (0 = unlimited)',
        },
        {
          name: 'includeEmptyFields',
          displayName: 'Include Empty Fields',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const operation = nodeParams.operation;
    const inputField = nodeParams.inputField || 'data';
    const outputField = nodeParams.outputField || 'data';
    const options = nodeParams.options || {};

    const outputItems = inputItems.map(item => {
      const inputData = item.json[inputField];

      if (operation === 'parse') {
        const parsed = parseCSV(inputData, options);
        return {
          json: {
            ...item.json,
            [outputField]: parsed,
          },
        };
      } else {
        const csv = stringifyCSV(inputData, options);
        return {
          json: {
            ...item.json,
            [outputField]: csv,
          },
        };
      }
    });

    return { items: outputItems };
  },
};

// CSV Read Node (from file/URL)
export const csvReadNode: NodeDefinition = {
  name: 'Read CSV',
  type: 'readCsv',
  category: 'data',
  description: 'Read CSV from file or URL',
  icon: 'file-input',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'source',
      displayName: 'Source',
      type: 'options',
      options: [
        { name: 'File Path', value: 'file' },
        { name: 'URL', value: 'url' },
        { name: 'Binary Data', value: 'binary' },
      ],
      default: 'file',
    },
    {
      name: 'filePath',
      displayName: 'File Path',
      type: 'string',
      default: '',
      displayOptions: { show: { source: ['file'] } },
    },
    {
      name: 'url',
      displayName: 'URL',
      type: 'string',
      default: '',
      displayOptions: { show: { source: ['url'] } },
    },
    {
      name: 'binaryField',
      displayName: 'Binary Field',
      type: 'string',
      default: 'data',
      displayOptions: { show: { source: ['binary'] } },
    },
    {
      name: 'outputMode',
      displayName: 'Output Mode',
      type: 'options',
      options: [
        { name: 'One Item Per Row', value: 'rows' },
        { name: 'Single Item with Array', value: 'array' },
      ],
      default: 'rows',
    },
    {
      name: 'options',
      displayName: 'CSV Options',
      type: 'collection',
      default: {},
      options: [
        { name: 'delimiter', displayName: 'Delimiter', type: 'string', default: ',' },
        { name: 'header', displayName: 'Has Header', type: 'boolean', default: true },
        { name: 'encoding', displayName: 'Encoding', type: 'string', default: 'utf-8' },
        { name: 'skipRows', displayName: 'Skip Rows', type: 'number', default: 0 },
        { name: 'maxRows', displayName: 'Max Rows', type: 'number', default: 0 },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const source = nodeParams.source;
    const outputMode = nodeParams.outputMode;
    const options = nodeParams.options || {};

    let csvData: string = '';

    // Read CSV data based on source
    if (source === 'file') {
      const fs = await import('fs/promises');
      csvData = await fs.readFile(nodeParams.filePath, options.encoding || 'utf-8');
    } else if (source === 'url') {
      const response = await fetch(nodeParams.url);
      csvData = await response.text();
    } else if (source === 'binary' && inputItems[0]) {
      const binaryData = inputItems[0].binary?.[nodeParams.binaryField];
      if (binaryData) {
        csvData = Buffer.from(binaryData.data, 'base64').toString(options.encoding || 'utf-8');
      }
    }

    // Skip rows if needed
    if (options.skipRows > 0) {
      const lines = csvData.split('\n');
      csvData = lines.slice(options.skipRows).join('\n');
    }

    const parsed = parseCSV(csvData, options);

    // Limit rows if needed
    const rows = options.maxRows > 0 ? parsed.slice(0, options.maxRows) : parsed;

    if (outputMode === 'rows') {
      return {
        items: rows.map(row => ({ json: row })),
      };
    } else {
      return {
        items: [{ json: { data: rows, rowCount: rows.length } }],
      };
    }
  },
};

// CSV Write Node
export const csvWriteNode: NodeDefinition = {
  name: 'Write CSV',
  type: 'writeCsv',
  category: 'data',
  description: 'Write data to CSV format',
  icon: 'file-output',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'destination',
      displayName: 'Destination',
      type: 'options',
      options: [
        { name: 'File', value: 'file' },
        { name: 'Binary Output', value: 'binary' },
        { name: 'String Output', value: 'string' },
      ],
      default: 'string',
    },
    {
      name: 'filePath',
      displayName: 'File Path',
      type: 'string',
      default: '',
      displayOptions: { show: { destination: ['file'] } },
    },
    {
      name: 'binaryField',
      displayName: 'Binary Field Name',
      type: 'string',
      default: 'csv',
      displayOptions: { show: { destination: ['binary'] } },
    },
    {
      name: 'outputField',
      displayName: 'Output Field',
      type: 'string',
      default: 'csv',
      displayOptions: { show: { destination: ['string'] } },
    },
    {
      name: 'columns',
      displayName: 'Columns to Include',
      type: 'string',
      default: '',
      description: 'Comma-separated column names (empty = all)',
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        { name: 'delimiter', displayName: 'Delimiter', type: 'string', default: ',' },
        { name: 'includeHeader', displayName: 'Include Header', type: 'boolean', default: true },
        { name: 'quote', displayName: 'Quote Character', type: 'string', default: '"' },
        { name: 'lineEnding', displayName: 'Line Ending', type: 'options', options: [
          { name: 'Unix (LF)', value: '\n' },
          { name: 'Windows (CRLF)', value: '\r\n' },
        ], default: '\n' },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const destination = nodeParams.destination;
    const options = nodeParams.options || {};

    // Get data to convert
    const data = inputItems.map(item => item.json);

    // Filter columns if specified
    let columns: string[] | undefined;
    if (nodeParams.columns) {
      columns = nodeParams.columns.split(',').map((c: string) => c.trim());
    }

    const csv = stringifyCSV(data, { ...options, columns });

    if (destination === 'file') {
      const fs = await import('fs/promises');
      await fs.writeFile(nodeParams.filePath, csv, 'utf-8');
      return {
        items: [{ json: { success: true, filePath: nodeParams.filePath, rowCount: data.length } }],
      };
    } else if (destination === 'binary') {
      return {
        items: [{
          json: { rowCount: data.length },
          binary: {
            [nodeParams.binaryField]: {
              data: Buffer.from(csv).toString('base64'),
              mimeType: 'text/csv',
              fileName: 'output.csv',
            },
          },
        }],
      };
    } else {
      return {
        items: [{ json: { [nodeParams.outputField]: csv, rowCount: data.length } }],
      };
    }
  },
};

// Spreadsheet Node (Excel-like operations)
export const spreadsheetNode: NodeDefinition = {
  name: 'Spreadsheet',
  type: 'spreadsheet',
  category: 'data',
  description: 'Excel-like operations on tabular data',
  icon: 'table',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      options: [
        { name: 'Add Column', value: 'addColumn' },
        { name: 'Remove Column', value: 'removeColumn' },
        { name: 'Rename Column', value: 'renameColumn' },
        { name: 'Reorder Columns', value: 'reorderColumns' },
        { name: 'Filter Rows', value: 'filterRows' },
        { name: 'Sort', value: 'sort' },
        { name: 'Aggregate', value: 'aggregate' },
        { name: 'Pivot', value: 'pivot' },
        { name: 'Unpivot', value: 'unpivot' },
        { name: 'Deduplicate', value: 'deduplicate' },
        { name: 'Fill Down', value: 'fillDown' },
        { name: 'Transpose', value: 'transpose' },
      ],
      default: 'addColumn',
    },
    // Add Column options
    {
      name: 'columnName',
      displayName: 'Column Name',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['addColumn', 'removeColumn', 'fillDown'] } },
    },
    {
      name: 'columnValue',
      displayName: 'Column Value/Expression',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['addColumn'] } },
    },
    // Rename Column options
    {
      name: 'renames',
      displayName: 'Renames',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['renameColumn'] } },
      options: [{
        name: 'rename',
        displayName: 'Rename',
        values: [
          { name: 'from', displayName: 'From', type: 'string', default: '' },
          { name: 'to', displayName: 'To', type: 'string', default: '' },
        ],
      }],
    },
    // Sort options
    {
      name: 'sortBy',
      displayName: 'Sort By',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sort'] } },
    },
    {
      name: 'sortOrder',
      displayName: 'Order',
      type: 'options',
      options: [
        { name: 'Ascending', value: 'asc' },
        { name: 'Descending', value: 'desc' },
      ],
      default: 'asc',
      displayOptions: { show: { operation: ['sort'] } },
    },
    // Aggregate options
    {
      name: 'groupBy',
      displayName: 'Group By',
      type: 'string',
      default: '',
      description: 'Comma-separated column names',
      displayOptions: { show: { operation: ['aggregate', 'pivot'] } },
    },
    {
      name: 'aggregations',
      displayName: 'Aggregations',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['aggregate'] } },
      options: [{
        name: 'aggregation',
        displayName: 'Aggregation',
        values: [
          { name: 'column', displayName: 'Column', type: 'string', default: '' },
          { name: 'function', displayName: 'Function', type: 'options', options: [
            { name: 'Sum', value: 'sum' },
            { name: 'Average', value: 'avg' },
            { name: 'Count', value: 'count' },
            { name: 'Min', value: 'min' },
            { name: 'Max', value: 'max' },
            { name: 'First', value: 'first' },
            { name: 'Last', value: 'last' },
            { name: 'Concat', value: 'concat' },
          ], default: 'sum' },
          { name: 'outputName', displayName: 'Output Name', type: 'string', default: '' },
        ],
      }],
    },
    // Deduplicate options
    {
      name: 'dedupeColumns',
      displayName: 'Columns to Check',
      type: 'string',
      default: '',
      description: 'Comma-separated columns (empty = all)',
      displayOptions: { show: { operation: ['deduplicate'] } },
    },
    {
      name: 'keepFirst',
      displayName: 'Keep',
      type: 'options',
      options: [
        { name: 'First Occurrence', value: 'first' },
        { name: 'Last Occurrence', value: 'last' },
      ],
      default: 'first',
      displayOptions: { show: { operation: ['deduplicate'] } },
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const operation = nodeParams.operation;

    let data = inputItems.map(item => ({ ...item.json }));

    switch (operation) {
      case 'addColumn':
        data = data.map(row => ({
          ...row,
          [nodeParams.columnName]: evaluateExpression(nodeParams.columnValue, row),
        }));
        break;

      case 'removeColumn':
        const columnsToRemove = nodeParams.columnName.split(',').map((c: string) => c.trim());
        data = data.map(row => {
          const newRow = { ...row };
          columnsToRemove.forEach((col: string) => delete newRow[col]);
          return newRow;
        });
        break;

      case 'renameColumn':
        const renames = nodeParams.renames?.rename || [];
        data = data.map(row => {
          const newRow = { ...row };
          renames.forEach((r: any) => {
            if (r.from in newRow) {
              newRow[r.to] = newRow[r.from];
              delete newRow[r.from];
            }
          });
          return newRow;
        });
        break;

      case 'sort':
        const sortBy = nodeParams.sortBy;
        const sortOrder = nodeParams.sortOrder === 'desc' ? -1 : 1;
        data.sort((a, b) => {
          if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
          if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
          return 0;
        });
        break;

      case 'aggregate':
        data = aggregateData(data, nodeParams);
        break;

      case 'deduplicate':
        data = deduplicateData(data, nodeParams);
        break;

      case 'transpose':
        data = transposeData(data);
        break;

      case 'fillDown':
        data = fillDownColumn(data, nodeParams.columnName);
        break;
    }

    return {
      items: data.map(row => ({ json: row })),
    };
  },
};

// Data Deduplication Node
export const deduplicateNode: NodeDefinition = {
  name: 'Remove Duplicates',
  type: 'removeDuplicates',
  category: 'data',
  description: 'Remove duplicate items based on specified fields',
  icon: 'copy-slash',
  version: 1,
  inputs: ['main'],
  outputs: ['main', 'duplicates'],

  properties: [
    {
      name: 'compareFields',
      displayName: 'Fields to Compare',
      type: 'string',
      default: '',
      description: 'Comma-separated field names (empty = compare all fields)',
    },
    {
      name: 'keepStrategy',
      displayName: 'When Duplicates Found',
      type: 'options',
      options: [
        { name: 'Keep First', value: 'first' },
        { name: 'Keep Last', value: 'last' },
        { name: 'Keep All (Mark as Duplicate)', value: 'mark' },
      ],
      default: 'first',
    },
    {
      name: 'caseSensitive',
      displayName: 'Case Sensitive',
      type: 'boolean',
      default: true,
    },
    {
      name: 'outputDuplicates',
      displayName: 'Output Duplicates',
      type: 'boolean',
      default: false,
      description: 'Send duplicates to second output',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const fields = nodeParams.compareFields
      ? nodeParams.compareFields.split(',').map((f: string) => f.trim())
      : null;
    const keepStrategy = nodeParams.keepStrategy;
    const caseSensitive = nodeParams.caseSensitive;

    const seen = new Map<string, number>();
    const unique: any[] = [];
    const duplicates: any[] = [];

    const getKey = (item: any): string => {
      const values = fields
        ? fields.map((f: string) => item.json[f])
        : Object.values(item.json);

      let key = JSON.stringify(values);
      if (!caseSensitive) {
        key = key.toLowerCase();
      }
      return key;
    };

    // First pass: identify duplicates
    inputItems.forEach((item, index) => {
      const key = getKey(item);
      if (seen.has(key)) {
        if (keepStrategy === 'last') {
          const prevIndex = seen.get(key)!;
          duplicates.push(inputItems[prevIndex]);
          seen.set(key, index);
        } else {
          duplicates.push(item);
        }
      } else {
        seen.set(key, index);
      }
    });

    // Second pass: build unique list
    if (keepStrategy === 'mark') {
      const dupKeys = new Set<string>();
      inputItems.forEach(item => {
        const key = getKey(item);
        if (seen.get(key) !== inputItems.indexOf(item)) {
          dupKeys.add(key);
        }
      });

      inputItems.forEach(item => {
        const key = getKey(item);
        unique.push({
          json: {
            ...item.json,
            _isDuplicate: dupKeys.has(key),
          },
        });
      });
    } else {
      seen.forEach((index) => {
        unique.push(inputItems[index]);
      });
    }

    if (nodeParams.outputDuplicates) {
      return {
        items: unique,
        outputItems: {
          duplicates: duplicates,
        },
      };
    }

    return { items: unique };
  },
};

// Data Validation Node
export const dataValidationNode: NodeDefinition = {
  name: 'Validate Data',
  type: 'validateData',
  category: 'data',
  description: 'Validate data against rules and schemas',
  icon: 'check-circle',
  version: 1,
  inputs: ['main'],
  outputs: ['valid', 'invalid'],

  properties: [
    {
      name: 'validationMode',
      displayName: 'Validation Mode',
      type: 'options',
      options: [
        { name: 'Field Rules', value: 'rules' },
        { name: 'JSON Schema', value: 'jsonSchema' },
      ],
      default: 'rules',
    },
    {
      name: 'rules',
      displayName: 'Validation Rules',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { validationMode: ['rules'] } },
      options: [{
        name: 'rule',
        displayName: 'Rule',
        values: [
          { name: 'field', displayName: 'Field', type: 'string', default: '' },
          { name: 'type', displayName: 'Validation Type', type: 'options', options: [
            { name: 'Required', value: 'required' },
            { name: 'Email', value: 'email' },
            { name: 'URL', value: 'url' },
            { name: 'Number', value: 'number' },
            { name: 'Integer', value: 'integer' },
            { name: 'Boolean', value: 'boolean' },
            { name: 'Date', value: 'date' },
            { name: 'Regex Pattern', value: 'regex' },
            { name: 'Min Length', value: 'minLength' },
            { name: 'Max Length', value: 'maxLength' },
            { name: 'Min Value', value: 'min' },
            { name: 'Max Value', value: 'max' },
            { name: 'In List', value: 'enum' },
          ], default: 'required' },
          { name: 'value', displayName: 'Value/Pattern', type: 'string', default: '' },
          { name: 'message', displayName: 'Error Message', type: 'string', default: '' },
        ],
      }],
    },
    {
      name: 'jsonSchema',
      displayName: 'JSON Schema',
      type: 'json',
      default: '{}',
      displayOptions: { show: { validationMode: ['jsonSchema'] } },
    },
    {
      name: 'stopOnFirstError',
      displayName: 'Stop on First Error',
      type: 'boolean',
      default: false,
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const validationMode = nodeParams.validationMode;

    const valid: any[] = [];
    const invalid: any[] = [];

    for (const item of inputItems) {
      const errors: string[] = [];

      if (validationMode === 'rules') {
        const rules = nodeParams.rules?.rule || [];

        for (const rule of rules) {
          const value = item.json[rule.field];
          const error = validateField(value, rule);

          if (error) {
            errors.push(rule.message || error);
            if (nodeParams.stopOnFirstError) break;
          }
        }
      } else {
        // JSON Schema validation would go here
        // Using a library like ajv
      }

      if (errors.length === 0) {
        valid.push(item);
      } else {
        invalid.push({
          json: {
            ...item.json,
            _validationErrors: errors,
          },
        });
      }
    }

    return {
      items: valid,
      outputItems: {
        invalid: invalid,
      },
    };
  },
};

// Helper Functions
function parseCSV(data: string, options: any = {}): any[] {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const hasHeader = options.header !== false;
  const trimFields = options.trimFields !== false;
  const skipEmptyLines = options.skipEmptyLines !== false;

  const lines = data.split(/\r?\n/);
  const result: any[] = [];

  let headers: string[] = [];
  let startRow = 0;

  if (hasHeader && lines.length > 0) {
    headers = parseLine(lines[0], delimiter, quote);
    startRow = 1;
  }

  if (options.columns) {
    headers = options.columns.split(',').map((c: string) => c.trim());
  }

  for (let i = startRow; i < lines.length; i++) {
    if (skipEmptyLines && !lines[i].trim()) continue;
    if (options.maxRows && result.length >= options.maxRows) break;

    const values = parseLine(lines[i], delimiter, quote);

    if (headers.length > 0) {
      const row: any = {};
      headers.forEach((header, idx) => {
        let value = values[idx] || '';
        if (trimFields) value = value.trim();
        if (options.includeEmptyFields !== false || value) {
          row[header] = value;
        }
      });
      result.push(row);
    } else {
      result.push(values.map(v => trimFields ? v.trim() : v));
    }
  }

  return result;
}

function parseLine(line: string, delimiter: string, quote: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === quote) {
      if (inQuotes && line[i + 1] === quote) {
        current += quote;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function stringifyCSV(data: any[], options: any = {}): string {
  if (!data || data.length === 0) return '';

  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const lineEnding = options.lineEnding || '\n';
  const includeHeader = options.includeHeader !== false;

  const columns = options.columns || Object.keys(data[0]);
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(columns.map((c: string) => escapeField(c, delimiter, quote)).join(delimiter));
  }

  for (const row of data) {
    const values = columns.map((col: string) => {
      const value = row[col];
      return escapeField(value == null ? '' : String(value), delimiter, quote);
    });
    lines.push(values.join(delimiter));
  }

  return lines.join(lineEnding);
}

function escapeField(value: string, delimiter: string, quote: string): string {
  if (value.includes(delimiter) || value.includes(quote) || value.includes('\n')) {
    return quote + value.replace(new RegExp(quote, 'g'), quote + quote) + quote;
  }
  return value;
}

function evaluateExpression(expr: string, row: any): any {
  // Simple expression evaluation
  if (expr.startsWith('=')) {
    const formula = expr.substring(1);
    // Support basic field references like {{fieldName}}
    const evaluated = formula.replace(/\{\{(\w+)\}\}/g, (_, field) => {
      return row[field] ?? '';
    });
    try {
      return eval(evaluated);
    } catch {
      return evaluated;
    }
  }
  return expr;
}

function aggregateData(data: any[], params: any): any[] {
  const groupBy = params.groupBy ? params.groupBy.split(',').map((g: string) => g.trim()) : [];
  const aggregations = params.aggregations?.aggregation || [];

  if (groupBy.length === 0) {
    // Aggregate all rows
    const result: any = {};
    aggregations.forEach((agg: any) => {
      result[agg.outputName || `${agg.function}_${agg.column}`] = calculateAggregation(
        data.map(r => r[agg.column]),
        agg.function
      );
    });
    return [result];
  }

  // Group data
  const groups = new Map<string, any[]>();
  data.forEach(row => {
    const key = groupBy.map((g: string) => row[g]).join('|');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  // Aggregate each group
  const results: any[] = [];
  groups.forEach((rows, key) => {
    const result: any = {};

    // Add group by fields
    groupBy.forEach((g: string, i: number) => {
      result[g] = key.split('|')[i];
    });

    // Calculate aggregations
    aggregations.forEach((agg: any) => {
      result[agg.outputName || `${agg.function}_${agg.column}`] = calculateAggregation(
        rows.map(r => r[agg.column]),
        agg.function
      );
    });

    results.push(result);
  });

  return results;
}

function calculateAggregation(values: any[], func: string): any {
  const numbers = values.filter(v => typeof v === 'number' || !isNaN(parseFloat(v))).map(Number);

  switch (func) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    case 'first':
      return values[0];
    case 'last':
      return values[values.length - 1];
    case 'concat':
      return values.join(', ');
    default:
      return null;
  }
}

function deduplicateData(data: any[], params: any): any[] {
  const columns = params.dedupeColumns
    ? params.dedupeColumns.split(',').map((c: string) => c.trim())
    : null;
  const keepFirst = params.keepFirst !== 'last';

  const seen = new Map<string, any>();

  data.forEach(row => {
    const key = columns
      ? JSON.stringify(columns.map((c: string) => row[c]))
      : JSON.stringify(row);

    if (!seen.has(key) || !keepFirst) {
      seen.set(key, row);
    }
  });

  return Array.from(seen.values());
}

function transposeData(data: any[]): any[] {
  if (data.length === 0) return [];

  const keys = Object.keys(data[0]);
  const result: any[] = [];

  keys.forEach(key => {
    const row: any = { field: key };
    data.forEach((item, idx) => {
      row[`value_${idx}`] = item[key];
    });
    result.push(row);
  });

  return result;
}

function fillDownColumn(data: any[], column: string): any[] {
  let lastValue: any = null;

  return data.map(row => {
    if (row[column] != null && row[column] !== '') {
      lastValue = row[column];
    }
    return { ...row, [column]: lastValue };
  });
}

function validateField(value: any, rule: any): string | null {
  const { type, value: ruleValue } = rule;

  switch (type) {
    case 'required':
      if (value == null || value === '') return 'Field is required';
      break;
    case 'email':
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email';
      break;
    case 'url':
      try {
        new URL(value);
      } catch {
        return 'Invalid URL';
      }
      break;
    case 'number':
      if (isNaN(Number(value))) return 'Must be a number';
      break;
    case 'integer':
      if (!Number.isInteger(Number(value))) return 'Must be an integer';
      break;
    case 'regex':
      if (value && !new RegExp(ruleValue).test(value)) return 'Does not match pattern';
      break;
    case 'minLength':
      if (value && String(value).length < Number(ruleValue)) return `Min length is ${ruleValue}`;
      break;
    case 'maxLength':
      if (value && String(value).length > Number(ruleValue)) return `Max length is ${ruleValue}`;
      break;
    case 'min':
      if (Number(value) < Number(ruleValue)) return `Min value is ${ruleValue}`;
      break;
    case 'max':
      if (Number(value) > Number(ruleValue)) return `Max value is ${ruleValue}`;
      break;
    case 'enum':
      const allowed = ruleValue.split(',').map((v: string) => v.trim());
      if (!allowed.includes(String(value))) return `Must be one of: ${allowed.join(', ')}`;
      break;
  }

  return null;
}

export const dataProcessingNodes = [
  csvParserNode,
  csvReadNode,
  csvWriteNode,
  spreadsheetNode,
  deduplicateNode,
  dataValidationNode,
];

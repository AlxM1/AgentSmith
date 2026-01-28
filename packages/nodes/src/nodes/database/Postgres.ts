import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Postgres = createProgrammaticNode({
  name: 'postgres',
  displayName: 'PostgreSQL',
  description: 'Execute SQL queries on PostgreSQL database',
  icon: 'file:postgres.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'PostgreSQL',
  },
  credentials: [
    { name: 'postgresApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Execute Query', value: 'executeQuery' },
        { name: 'Insert', value: 'insert' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
        { name: 'Upsert', value: 'upsert' },
      ],
      default: 'executeQuery',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      typeOptions: {
        rows: 5,
        editor: 'code',
        editorLanguage: 'sql',
      },
      default: '',
      displayOptions: {
        show: {
          operation: ['executeQuery'],
        },
      },
    },
    {
      displayName: 'Table',
      name: 'table',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          operation: ['insert', 'update', 'delete', 'upsert'],
        },
      },
    },
    {
      displayName: 'Columns',
      name: 'columns',
      type: 'string',
      default: '*',
      description: 'Comma-separated list of columns to use',
      displayOptions: {
        show: {
          operation: ['insert', 'update', 'upsert'],
        },
      },
    },
    {
      displayName: 'Where Clause',
      name: 'where',
      type: 'string',
      default: '',
      placeholder: 'id = $1',
      displayOptions: {
        show: {
          operation: ['update', 'delete'],
        },
      },
    },
    {
      displayName: 'Conflict Column',
      name: 'conflictColumn',
      type: 'string',
      default: 'id',
      description: 'Column to check for conflicts in upsert',
      displayOptions: {
        show: {
          operation: ['upsert'],
        },
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Query Parameters',
          name: 'queryParams',
          type: 'json',
          default: '[]',
          description: 'Parameters for parameterized queries',
        },
        {
          displayName: 'Return Results',
          name: 'returnResults',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Batch Size',
          name: 'batchSize',
          type: 'number',
          default: 1000,
          description: 'Number of rows to insert per batch',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('postgresApi');

    // In a real implementation, this would use a Postgres client like pg
    // This is a simplified example showing the interface

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let query = '';
        let params: any[] = [];

        if (operation === 'executeQuery') {
          query = this.getNodeParameter('query', i) as string;
          try {
            params = JSON.parse(options.queryParams || '[]');
          } catch {}
        } else if (operation === 'insert') {
          const table = this.getNodeParameter('table', i) as string;
          const columns = this.getNodeParameter('columns', i) as string;

          const cols = columns === '*'
            ? Object.keys(items[i].json)
            : columns.split(',').map(c => c.trim());

          const values = cols.map(col => items[i].json[col]);
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');

          query = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
          params = values;
        } else if (operation === 'update') {
          const table = this.getNodeParameter('table', i) as string;
          const columns = this.getNodeParameter('columns', i) as string;
          const where = this.getNodeParameter('where', i) as string;

          const cols = columns === '*'
            ? Object.keys(items[i].json)
            : columns.split(',').map(c => c.trim());

          const setClauses = cols.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
          const values = cols.map(col => items[i].json[col]);

          query = `UPDATE ${table} SET ${setClauses} WHERE ${where} RETURNING *`;
          params = values;
        } else if (operation === 'delete') {
          const table = this.getNodeParameter('table', i) as string;
          const where = this.getNodeParameter('where', i) as string;

          query = `DELETE FROM ${table} WHERE ${where} RETURNING *`;
        } else if (operation === 'upsert') {
          const table = this.getNodeParameter('table', i) as string;
          const columns = this.getNodeParameter('columns', i) as string;
          const conflictColumn = this.getNodeParameter('conflictColumn', i) as string;

          const cols = columns === '*'
            ? Object.keys(items[i].json)
            : columns.split(',').map(c => c.trim());

          const values = cols.map(col => items[i].json[col]);
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
          const updateClauses = cols
            .filter(c => c !== conflictColumn)
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');

          query = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
                   ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateClauses}
                   RETURNING *`;
          params = values;
        }

        // Simulated response - in real implementation would execute query
        returnData.push({
          json: {
            query,
            params,
            operation,
            // results would come from actual database execution
            message: 'Query prepared successfully (execute with pg client)',
            connectionConfig: {
              host: credentials.host,
              port: credentials.port,
              database: credentials.database,
              user: credentials.user,
            },
          },
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  },
});

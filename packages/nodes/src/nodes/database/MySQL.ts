import { createProgrammaticNode } from '@agentsmith/shared';

export const MySQL = createProgrammaticNode({
  name: 'MySQL',
  displayName: 'MySQL',
  description: 'Execute SQL queries on MySQL database',
  icon: 'file:mysql.svg',
  group: ['database'],
  version: 1,
  defaults: { name: 'MySQL' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'mySqlApi', required: true }],
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
      ],
      default: 'executeQuery',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['executeQuery'] } },
      placeholder: 'SELECT * FROM users WHERE id = ?',
    },
    {
      displayName: 'Parameters',
      name: 'parameters',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['executeQuery'] } },
      description: 'Comma-separated values for query parameters',
    },
    {
      displayName: 'Table',
      name: 'table',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['insert', 'update', 'delete'] } },
    },
    {
      displayName: 'Columns',
      name: 'columns',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['insert', 'update'] } },
      description: 'Comma-separated column names',
    },
    {
      displayName: 'Values',
      name: 'values',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['insert'] } },
      description: 'Comma-separated values',
    },
    {
      displayName: 'Update Values',
      name: 'updateValues',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['update'] } },
      options: [
        {
          displayName: 'Values',
          name: 'values',
          values: [
            { displayName: 'Column', name: 'column', type: 'string', default: '' },
            { displayName: 'Value', name: 'value', type: 'string', default: '' },
          ],
        },
      ],
    },
    {
      displayName: 'Where Clause',
      name: 'whereClause',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['update', 'delete'] } },
      placeholder: 'id = 1',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Query Batching',
          name: 'queryBatching',
          type: 'options',
          options: [
            { name: 'Single Query', value: 'single' },
            { name: 'Batch (Transaction)', value: 'transaction' },
            { name: 'Batch (Independently)', value: 'independently' },
          ],
          default: 'single',
        },
        {
          displayName: 'Return Last Insert ID',
          name: 'returnLastInsertId',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('mySqlApi');

    // In production, this would use mysql2 package
    const connection = await createMySQLConnection(credentials);

    try {
      for (let i = 0; i < items.length; i++) {
        const operation = this.getNodeParameter('operation', i) as string;

        try {
          let result: any;

          switch (operation) {
            case 'executeQuery': {
              const query = this.getNodeParameter('query', i) as string;
              const paramsStr = this.getNodeParameter('parameters', i) as string;
              const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];
              result = await connection.query(query, params);
              break;
            }

            case 'insert': {
              const table = this.getNodeParameter('table', i) as string;
              const columns = this.getNodeParameter('columns', i) as string;
              const values = this.getNodeParameter('values', i) as string;
              const options = this.getNodeParameter('options', i) as any;

              const query = `INSERT INTO ${table} (${columns}) VALUES (${values.split(',').map(() => '?').join(', ')})`;
              const params = values.split(',').map(v => v.trim());

              result = await connection.query(query, params);

              if (options.returnLastInsertId) {
                result = { ...result, lastInsertId: result.insertId };
              }
              break;
            }

            case 'update': {
              const table = this.getNodeParameter('table', i) as string;
              const updateValues = this.getNodeParameter('updateValues', i) as any;
              const whereClause = this.getNodeParameter('whereClause', i) as string;

              const setClauses: string[] = [];
              const params: any[] = [];

              if (updateValues.values) {
                for (const val of updateValues.values) {
                  setClauses.push(`${val.column} = ?`);
                  params.push(val.value);
                }
              }

              const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
              result = await connection.query(query, params);
              break;
            }

            case 'delete': {
              const table = this.getNodeParameter('table', i) as string;
              const whereClause = this.getNodeParameter('whereClause', i) as string;

              const query = `DELETE FROM ${table} WHERE ${whereClause}`;
              result = await connection.query(query);
              break;
            }
          }

          const rows = Array.isArray(result) ? result : [result];
          for (const row of rows) {
            returnData.push({ json: row });
          }
        } catch (error: any) {
          if (this.continueOnFail()) {
            returnData.push({ json: { error: error.message } });
          } else {
            throw error;
          }
        }
      }
    } finally {
      await connection.close();
    }

    return [returnData];
  },
});

// Mock MySQL connection for typing - replace with actual mysql2 in production
async function createMySQLConnection(credentials: any) {
  return {
    query: async (sql: string, params?: any[]): Promise<any> => {
      // This would be actual MySQL query execution
      console.log('MySQL Query:', sql, params);
      return [];
    },
    close: async () => {
      // Close connection
    },
  };
}

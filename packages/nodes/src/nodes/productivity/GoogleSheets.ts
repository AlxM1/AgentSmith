import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const GoogleSheets = createProgrammaticNode({
  name: 'googleSheets',
  displayName: 'Google Sheets',
  description: 'Read and write data to Google Sheets',
  icon: 'file:googlesheets.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'Google Sheets',
  },
  credentials: [
    { name: 'googleSheetsOAuth2', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Read Rows', value: 'read' },
        { name: 'Append Rows', value: 'append' },
        { name: 'Update Rows', value: 'update' },
        { name: 'Clear', value: 'clear' },
        { name: 'Delete Rows', value: 'delete' },
        { name: 'Lookup', value: 'lookup' },
      ],
      default: 'read',
    },
    {
      displayName: 'Spreadsheet ID',
      name: 'spreadsheetId',
      type: 'string',
      default: '',
      required: true,
      description: 'The ID from the spreadsheet URL',
    },
    {
      displayName: 'Sheet Name',
      name: 'sheetName',
      type: 'string',
      default: 'Sheet1',
      required: true,
    },
    {
      displayName: 'Range',
      name: 'range',
      type: 'string',
      default: 'A:Z',
      description: 'The range to read/write (e.g., A1:D10)',
      displayOptions: {
        show: {
          operation: ['read', 'clear'],
        },
      },
    },
    {
      displayName: 'Data Mode',
      name: 'dataMode',
      type: 'options',
      options: [
        { name: 'Auto-map from Input', value: 'autoMap' },
        { name: 'Manual', value: 'manual' },
      ],
      default: 'autoMap',
      displayOptions: {
        show: {
          operation: ['append', 'update'],
        },
      },
    },
    {
      displayName: 'Values',
      name: 'values',
      type: 'json',
      default: '[]',
      displayOptions: {
        show: {
          operation: ['append', 'update'],
          dataMode: ['manual'],
        },
      },
    },
    {
      displayName: 'Lookup Column',
      name: 'lookupColumn',
      type: 'string',
      default: 'A',
      displayOptions: {
        show: {
          operation: ['lookup', 'update', 'delete'],
        },
      },
    },
    {
      displayName: 'Lookup Value',
      name: 'lookupValue',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          operation: ['lookup', 'update', 'delete'],
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
          displayName: 'Header Row',
          name: 'headerRow',
          type: 'number',
          default: 1,
          description: 'Row number containing headers (1-indexed)',
        },
        {
          displayName: 'Value Input Option',
          name: 'valueInputOption',
          type: 'options',
          options: [
            { name: 'Raw', value: 'RAW' },
            { name: 'User Entered', value: 'USER_ENTERED' },
          ],
          default: 'USER_ENTERED',
        },
        {
          displayName: 'Value Render Option',
          name: 'valueRenderOption',
          type: 'options',
          options: [
            { name: 'Formatted', value: 'FORMATTED_VALUE' },
            { name: 'Unformatted', value: 'UNFORMATTED_VALUE' },
            { name: 'Formula', value: 'FORMULA' },
          ],
          default: 'FORMATTED_VALUE',
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('googleSheetsOAuth2');
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const spreadsheetId = this.getNodeParameter('spreadsheetId', i) as string;
      const sheetName = this.getNodeParameter('sheetName', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;

        if (operation === 'read') {
          const range = this.getNodeParameter('range', i) as string;
          const fullRange = `${sheetName}!${range}`;

          responseData = await this.helpers.request({
            method: 'GET',
            url: `${baseUrl}/${spreadsheetId}/values/${encodeURIComponent(fullRange)}`,
            headers: {
              'Authorization': `Bearer ${credentials.accessToken}`,
            },
            qs: {
              valueRenderOption: options.valueRenderOption || 'FORMATTED_VALUE',
            },
            json: true,
          });

          // Convert to objects using headers
          if (responseData.values && responseData.values.length > 0) {
            const headerRow = options.headerRow || 1;
            const headers = responseData.values[headerRow - 1] || [];
            const dataRows = responseData.values.slice(headerRow);

            for (const row of dataRows) {
              const obj: Record<string, any> = {};
              headers.forEach((header: string, index: number) => {
                obj[header] = row[index] ?? '';
              });
              returnData.push({
                json: obj,
                pairedItem: { item: i },
              });
            }
            continue;
          }
        } else if (operation === 'append') {
          const dataMode = this.getNodeParameter('dataMode', i) as string;
          let values: any[][];

          if (dataMode === 'autoMap') {
            // Convert input item to row
            const headers = Object.keys(items[i].json);
            values = [headers.map(h => items[i].json[h])];
          } else {
            values = JSON.parse(this.getNodeParameter('values', i) as string);
          }

          responseData = await this.helpers.request({
            method: 'POST',
            url: `${baseUrl}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append`,
            headers: {
              'Authorization': `Bearer ${credentials.accessToken}`,
              'Content-Type': 'application/json',
            },
            qs: {
              valueInputOption: options.valueInputOption || 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
            },
            body: { values },
            json: true,
          });
        } else if (operation === 'clear') {
          const range = this.getNodeParameter('range', i) as string;
          const fullRange = `${sheetName}!${range}`;

          responseData = await this.helpers.request({
            method: 'POST',
            url: `${baseUrl}/${spreadsheetId}/values/${encodeURIComponent(fullRange)}:clear`,
            headers: {
              'Authorization': `Bearer ${credentials.accessToken}`,
            },
            json: true,
          });
        }

        returnData.push({
          json: responseData || { success: true },
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

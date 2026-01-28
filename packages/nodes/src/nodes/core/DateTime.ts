import { createProgrammaticNode } from '@agentsmith/shared';

export const DateTime = createProgrammaticNode({
  name: 'DateTime',
  displayName: 'Date & Time',
  description: 'Manipulate date and time values',
  icon: 'fa:clock',
  group: ['transform'],
  version: 1,
  defaults: { name: 'Date & Time' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Add to Date', value: 'add' },
        { name: 'Subtract from Date', value: 'subtract' },
        { name: 'Format Date', value: 'format' },
        { name: 'Get Current Date', value: 'now' },
        { name: 'Parse Date', value: 'parse' },
        { name: 'Round Date', value: 'round' },
        { name: 'Get Time Between Dates', value: 'diff' },
        { name: 'Extract Part', value: 'extract' },
      ],
      default: 'now',
    },
    {
      displayName: 'Date',
      name: 'date',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['add', 'subtract', 'format', 'parse', 'round', 'diff', 'extract'] } },
      description: 'The date to manipulate',
    },
    {
      displayName: 'Duration',
      name: 'duration',
      type: 'number',
      default: 1,
      displayOptions: { show: { operation: ['add', 'subtract'] } },
    },
    {
      displayName: 'Time Unit',
      name: 'timeUnit',
      type: 'options',
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
        { name: 'Days', value: 'days' },
        { name: 'Weeks', value: 'weeks' },
        { name: 'Months', value: 'months' },
        { name: 'Years', value: 'years' },
      ],
      default: 'days',
      displayOptions: { show: { operation: ['add', 'subtract', 'round', 'diff'] } },
    },
    {
      displayName: 'Format',
      name: 'format',
      type: 'string',
      default: 'YYYY-MM-DD HH:mm:ss',
      displayOptions: { show: { operation: ['format'] } },
      description: 'The format string (moment.js format)',
    },
    {
      displayName: 'Date Part',
      name: 'datePart',
      type: 'options',
      options: [
        { name: 'Year', value: 'year' },
        { name: 'Month', value: 'month' },
        { name: 'Day', value: 'day' },
        { name: 'Hour', value: 'hour' },
        { name: 'Minute', value: 'minute' },
        { name: 'Second', value: 'second' },
        { name: 'Day of Week', value: 'dayOfWeek' },
        { name: 'Week of Year', value: 'weekOfYear' },
      ],
      default: 'day',
      displayOptions: { show: { operation: ['extract'] } },
    },
    {
      displayName: 'Second Date',
      name: 'date2',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['diff'] } },
      description: 'The second date for difference calculation',
    },
    {
      displayName: 'Output Field Name',
      name: 'outputFieldName',
      type: 'string',
      default: 'date',
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
          case 'now':
            result = new Date().toISOString();
            break;

          case 'add':
          case 'subtract': {
            const date = new Date(this.getNodeParameter('date', i) as string);
            const duration = this.getNodeParameter('duration', i) as number;
            const timeUnit = this.getNodeParameter('timeUnit', i) as string;
            const multiplier = operation === 'subtract' ? -1 : 1;

            const ms = {
              seconds: 1000,
              minutes: 60 * 1000,
              hours: 60 * 60 * 1000,
              days: 24 * 60 * 60 * 1000,
              weeks: 7 * 24 * 60 * 60 * 1000,
              months: 30 * 24 * 60 * 60 * 1000,
              years: 365 * 24 * 60 * 60 * 1000,
            }[timeUnit] || 24 * 60 * 60 * 1000;

            result = new Date(date.getTime() + duration * ms * multiplier).toISOString();
            break;
          }

          case 'format': {
            const date = new Date(this.getNodeParameter('date', i) as string);
            const format = this.getNodeParameter('format', i) as string;
            result = formatDate(date, format);
            break;
          }

          case 'parse': {
            const dateStr = this.getNodeParameter('date', i) as string;
            result = new Date(dateStr).toISOString();
            break;
          }

          case 'round': {
            const date = new Date(this.getNodeParameter('date', i) as string);
            const timeUnit = this.getNodeParameter('timeUnit', i) as string;
            result = roundDate(date, timeUnit).toISOString();
            break;
          }

          case 'diff': {
            const date1 = new Date(this.getNodeParameter('date', i) as string);
            const date2 = new Date(this.getNodeParameter('date2', i) as string);
            const timeUnit = this.getNodeParameter('timeUnit', i) as string;
            const diffMs = date2.getTime() - date1.getTime();

            const divisors: Record<string, number> = {
              seconds: 1000,
              minutes: 60 * 1000,
              hours: 60 * 60 * 1000,
              days: 24 * 60 * 60 * 1000,
              weeks: 7 * 24 * 60 * 60 * 1000,
              months: 30 * 24 * 60 * 60 * 1000,
              years: 365 * 24 * 60 * 60 * 1000,
            };

            result = Math.floor(diffMs / divisors[timeUnit]);
            break;
          }

          case 'extract': {
            const date = new Date(this.getNodeParameter('date', i) as string);
            const datePart = this.getNodeParameter('datePart', i) as string;

            const extractors: Record<string, () => number> = {
              year: () => date.getFullYear(),
              month: () => date.getMonth() + 1,
              day: () => date.getDate(),
              hour: () => date.getHours(),
              minute: () => date.getMinutes(),
              second: () => date.getSeconds(),
              dayOfWeek: () => date.getDay(),
              weekOfYear: () => getWeekOfYear(date),
            };

            result = extractors[datePart]();
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

function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('YY', date.getFullYear().toString().slice(-2))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

function roundDate(date: Date, unit: string): Date {
  const d = new Date(date);
  switch (unit) {
    case 'seconds':
      d.setMilliseconds(0);
      break;
    case 'minutes':
      d.setSeconds(0, 0);
      break;
    case 'hours':
      d.setMinutes(0, 0, 0);
      break;
    case 'days':
      d.setHours(0, 0, 0, 0);
      break;
    case 'weeks':
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      break;
    case 'months':
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      break;
    case 'years':
      d.setHours(0, 0, 0, 0);
      d.setMonth(0, 1);
      break;
  }
  return d;
}

function getWeekOfYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

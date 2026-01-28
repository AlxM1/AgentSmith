import { createPollingTrigger } from '@agentsmith/shared';

export const Schedule = createPollingTrigger({
  name: 'schedule',
  displayName: 'Schedule Trigger',
  description: 'Triggers workflow on a schedule',
  icon: 'fa:clock',
  group: ['trigger'],
  version: 1,
  defaults: {
    name: 'Schedule Trigger',
  },
  pollInterval: 60000, // Default 1 minute
  properties: [
    {
      displayName: 'Trigger Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Interval', value: 'interval' },
        { name: 'Cron', value: 'cron' },
      ],
      default: 'interval',
    },
    {
      displayName: 'Interval',
      name: 'interval',
      type: 'number',
      displayOptions: {
        show: {
          mode: ['interval'],
        },
      },
      default: 1,
    },
    {
      displayName: 'Unit',
      name: 'unit',
      type: 'options',
      displayOptions: {
        show: {
          mode: ['interval'],
        },
      },
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
        { name: 'Days', value: 'days' },
      ],
      default: 'hours',
    },
    {
      displayName: 'Cron Expression',
      name: 'cronExpression',
      type: 'string',
      displayOptions: {
        show: {
          mode: ['cron'],
        },
      },
      default: '0 * * * *',
      placeholder: '0 0 * * *',
      description: 'Standard cron expression (minute hour day-of-month month day-of-week)',
    },
    {
      displayName: 'Timezone',
      name: 'timezone',
      type: 'string',
      default: 'UTC',
      placeholder: 'America/New_York',
    },
  ],
});

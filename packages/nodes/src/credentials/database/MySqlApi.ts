import { createCredentialType } from '@agentsmith/shared';

export const MySqlApi = createCredentialType({
  name: 'mysqlApi',
  displayName: 'MySQL',
  documentationUrl: 'https://dev.mysql.com/doc/',
  properties: [
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'localhost',
      required: true,
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 3306,
      required: true,
    },
    {
      displayName: 'Database',
      name: 'database',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'User',
      name: 'user',
      type: 'string',
      default: 'root',
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'SSL',
      name: 'ssl',
      type: 'boolean',
      default: false,
    },
  ],
});

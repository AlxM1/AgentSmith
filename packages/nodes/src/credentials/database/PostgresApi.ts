import { createCredentialType } from '@agentsmith/shared';

export const PostgresApi = createCredentialType({
  name: 'postgresApi',
  displayName: 'PostgreSQL',
  documentationUrl: 'https://www.postgresql.org/docs/',
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
      default: 5432,
      required: true,
    },
    {
      displayName: 'Database',
      name: 'database',
      type: 'string',
      default: 'postgres',
      required: true,
    },
    {
      displayName: 'User',
      name: 'user',
      type: 'string',
      default: 'postgres',
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
      type: 'options',
      options: [
        { name: 'Disable', value: 'disable' },
        { name: 'Allow', value: 'allow' },
        { name: 'Require', value: 'require' },
        { name: 'Verify-CA', value: 'verify-ca' },
        { name: 'Verify-Full', value: 'verify-full' },
      ],
      default: 'disable',
    },
  ],
});

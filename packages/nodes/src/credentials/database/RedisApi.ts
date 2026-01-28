import { createCredentialType } from '@agentsmith/shared';

export const RedisApi = createCredentialType({
  name: 'redisApi',
  displayName: 'Redis',
  documentationUrl: 'https://redis.io/documentation',
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
      default: 6379,
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    },
    {
      displayName: 'Database Index',
      name: 'database',
      type: 'number',
      default: 0,
    },
    {
      displayName: 'SSL/TLS',
      name: 'ssl',
      type: 'boolean',
      default: false,
    },
  ],
});

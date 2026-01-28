import { createCredentialType } from '@agentsmith/shared';

export const MongoDbApi = createCredentialType({
  name: 'mongoDbApi',
  displayName: 'MongoDB',
  documentationUrl: 'https://docs.mongodb.com/',
  properties: [
    {
      displayName: 'Configuration Type',
      name: 'configurationType',
      type: 'options',
      options: [
        { name: 'Connection String', value: 'connectionString' },
        { name: 'Values', value: 'values' },
      ],
      default: 'connectionString',
    },
    {
      displayName: 'Connection String',
      name: 'connectionString',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      placeholder: 'mongodb://user:password@localhost:27017/database',
      displayOptions: {
        show: {
          configurationType: ['connectionString'],
        },
      },
    },
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'localhost',
      displayOptions: {
        show: {
          configurationType: ['values'],
        },
      },
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 27017,
      displayOptions: {
        show: {
          configurationType: ['values'],
        },
      },
    },
    {
      displayName: 'Database',
      name: 'database',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          configurationType: ['values'],
        },
      },
    },
    {
      displayName: 'User',
      name: 'user',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          configurationType: ['values'],
        },
      },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      displayOptions: {
        show: {
          configurationType: ['values'],
        },
      },
    },
  ],
});

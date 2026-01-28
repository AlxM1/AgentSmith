import { createProgrammaticNode } from '@agentsmith/shared';

export const Redis = createProgrammaticNode({
  name: 'Redis',
  displayName: 'Redis',
  description: 'Perform operations on Redis',
  icon: 'file:redis.svg',
  group: ['database'],
  version: 1,
  defaults: { name: 'Redis' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'redisApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Get', value: 'get' },
        { name: 'Set', value: 'set' },
        { name: 'Delete', value: 'delete' },
        { name: 'Keys', value: 'keys' },
        { name: 'Incr', value: 'incr' },
        { name: 'Publish', value: 'publish' },
        { name: 'Push (List)', value: 'push' },
        { name: 'Pop (List)', value: 'pop' },
        { name: 'Info', value: 'info' },
        { name: 'Hash Get', value: 'hget' },
        { name: 'Hash Set', value: 'hset' },
        { name: 'Hash Get All', value: 'hgetall' },
        { name: 'Set Add', value: 'sadd' },
        { name: 'Set Members', value: 'smembers' },
      ],
      default: 'get',
    },
    {
      displayName: 'Key',
      name: 'key',
      type: 'string',
      default: '',
      displayOptions: {
        show: { operation: ['get', 'set', 'delete', 'incr', 'push', 'pop', 'hget', 'hset', 'hgetall', 'sadd', 'smembers'] },
      },
    },
    {
      displayName: 'Value',
      name: 'value',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['set', 'publish', 'push', 'sadd'] } },
    },
    {
      displayName: 'Field',
      name: 'field',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['hget', 'hset'] } },
    },
    {
      displayName: 'Channel',
      name: 'channel',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['publish'] } },
    },
    {
      displayName: 'Key Pattern',
      name: 'keyPattern',
      type: 'string',
      default: '*',
      displayOptions: { show: { operation: ['keys'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'TTL (Seconds)',
          name: 'ttl',
          type: 'number',
          default: 0,
          description: 'Time to live in seconds (0 = no expiry)',
        },
        {
          displayName: 'Increment By',
          name: 'incrementBy',
          type: 'number',
          default: 1,
        },
        {
          displayName: 'List Position',
          name: 'listPosition',
          type: 'options',
          options: [
            { name: 'Left (LPUSH/LPOP)', value: 'left' },
            { name: 'Right (RPUSH/RPOP)', value: 'right' },
          ],
          default: 'right',
        },
        {
          displayName: 'Return Type',
          name: 'returnType',
          type: 'options',
          options: [
            { name: 'Auto-Detect', value: 'auto' },
            { name: 'String', value: 'string' },
            { name: 'JSON', value: 'json' },
            { name: 'Number', value: 'number' },
          ],
          default: 'auto',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('redisApi');

    // In production, this would use ioredis package
    const client = await createRedisConnection(credentials);

    try {
      for (let i = 0; i < items.length; i++) {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        try {
          let result: any;

          switch (operation) {
            case 'get': {
              const key = this.getNodeParameter('key', i) as string;
              result = await client.get(key);
              result = parseRedisValue(result, options.returnType);
              break;
            }

            case 'set': {
              const key = this.getNodeParameter('key', i) as string;
              const value = this.getNodeParameter('value', i) as string;
              const ttl = options.ttl || 0;

              if (ttl > 0) {
                await client.setex(key, ttl, value);
              } else {
                await client.set(key, value);
              }
              result = { success: true, key };
              break;
            }

            case 'delete': {
              const key = this.getNodeParameter('key', i) as string;
              const count = await client.del(key);
              result = { deleted: count };
              break;
            }

            case 'keys': {
              const pattern = this.getNodeParameter('keyPattern', i) as string;
              const keys = await client.keys(pattern);
              result = { keys };
              break;
            }

            case 'incr': {
              const key = this.getNodeParameter('key', i) as string;
              const incrementBy = options.incrementBy || 1;
              const value = await client.incrby(key, incrementBy);
              result = { key, value };
              break;
            }

            case 'publish': {
              const channel = this.getNodeParameter('channel', i) as string;
              const value = this.getNodeParameter('value', i) as string;
              const subscribers = await client.publish(channel, value);
              result = { channel, subscribers };
              break;
            }

            case 'push': {
              const key = this.getNodeParameter('key', i) as string;
              const value = this.getNodeParameter('value', i) as string;
              const position = options.listPosition || 'right';

              const length = position === 'left'
                ? await client.lpush(key, value)
                : await client.rpush(key, value);

              result = { key, length };
              break;
            }

            case 'pop': {
              const key = this.getNodeParameter('key', i) as string;
              const position = options.listPosition || 'right';

              const value = position === 'left'
                ? await client.lpop(key)
                : await client.rpop(key);

              result = { key, value: parseRedisValue(value, options.returnType) };
              break;
            }

            case 'info': {
              const info = await client.info();
              result = parseRedisInfo(info);
              break;
            }

            case 'hget': {
              const key = this.getNodeParameter('key', i) as string;
              const field = this.getNodeParameter('field', i) as string;
              const value = await client.hget(key, field);
              result = { key, field, value: parseRedisValue(value, options.returnType) };
              break;
            }

            case 'hset': {
              const key = this.getNodeParameter('key', i) as string;
              const field = this.getNodeParameter('field', i) as string;
              const value = this.getNodeParameter('value', i) as string;
              await client.hset(key, field, value);
              result = { success: true, key, field };
              break;
            }

            case 'hgetall': {
              const key = this.getNodeParameter('key', i) as string;
              result = await client.hgetall(key);
              break;
            }

            case 'sadd': {
              const key = this.getNodeParameter('key', i) as string;
              const value = this.getNodeParameter('value', i) as string;
              const added = await client.sadd(key, value);
              result = { key, added };
              break;
            }

            case 'smembers': {
              const key = this.getNodeParameter('key', i) as string;
              const members = await client.smembers(key);
              result = { key, members };
              break;
            }
          }

          returnData.push({ json: result ?? { value: null } });
        } catch (error: any) {
          if (this.continueOnFail()) {
            returnData.push({ json: { error: error.message } });
          } else {
            throw error;
          }
        }
      }
    } finally {
      await client.quit();
    }

    return [returnData];
  },
});

function parseRedisValue(value: any, returnType: string = 'auto'): any {
  if (value === null || value === undefined) return null;

  if (returnType === 'string') return String(value);
  if (returnType === 'number') return Number(value);
  if (returnType === 'json') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Auto-detect
  if (returnType === 'auto') {
    // Try number
    const num = Number(value);
    if (!isNaN(num) && String(num) === value) return num;

    // Try JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function parseRedisInfo(info: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection = 'default';

  for (const line of info.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      currentSection = trimmed.slice(2).toLowerCase();
      result[currentSection] = {};
    } else if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':');
      if (result[currentSection]) {
        result[currentSection][key] = parseRedisValue(value, 'auto');
      }
    }
  }

  return result;
}

// Mock Redis connection for typing - replace with actual ioredis in production
async function createRedisConnection(credentials: any) {
  return {
    get: async (key: string) => null,
    set: async (key: string, value: string) => 'OK',
    setex: async (key: string, ttl: number, value: string) => 'OK',
    del: async (key: string) => 1,
    keys: async (pattern: string) => [],
    incrby: async (key: string, increment: number) => increment,
    publish: async (channel: string, message: string) => 0,
    lpush: async (key: string, value: string) => 1,
    rpush: async (key: string, value: string) => 1,
    lpop: async (key: string) => null,
    rpop: async (key: string) => null,
    info: async () => '',
    hget: async (key: string, field: string) => null,
    hset: async (key: string, field: string, value: string) => 1,
    hgetall: async (key: string) => ({}),
    sadd: async (key: string, value: string) => 1,
    smembers: async (key: string) => [],
    quit: async () => {},
  };
}

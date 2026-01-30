/**
 * Message Queue Nodes
 * Kafka, RabbitMQ, and AWS SQS integrations
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../types/nodes.js';

// ==================== KAFKA NODES ====================

export const kafkaProducerNode: NodeDefinition = {
  name: 'Kafka Producer',
  type: 'kafkaProducer',
  category: 'messaging',
  description: 'Send messages to Apache Kafka topics',
  icon: 'send',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],
  credentials: ['kafkaCredentials'],

  properties: [
    {
      name: 'topic',
      displayName: 'Topic',
      type: 'string',
      default: '',
      required: true,
      description: 'Kafka topic to publish to',
    },
    {
      name: 'message',
      displayName: 'Message',
      type: 'string',
      default: '={{ JSON.stringify($json) }}',
      description: 'Message content (supports expressions)',
    },
    {
      name: 'key',
      displayName: 'Message Key',
      type: 'string',
      default: '',
      description: 'Optional partition key',
    },
    {
      name: 'headers',
      displayName: 'Headers',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [{
        name: 'header',
        displayName: 'Header',
        values: [
          { name: 'key', displayName: 'Key', type: 'string', default: '' },
          { name: 'value', displayName: 'Value', type: 'string', default: '' },
        ],
      }],
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'acks',
          displayName: 'Acknowledgments',
          type: 'options',
          options: [
            { name: 'None (0)', value: 0 },
            { name: 'Leader (1)', value: 1 },
            { name: 'All (-1)', value: -1 },
          ],
          default: 1,
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 30000,
        },
        {
          name: 'compression',
          displayName: 'Compression',
          type: 'options',
          options: [
            { name: 'None', value: 'none' },
            { name: 'GZIP', value: 'gzip' },
            { name: 'Snappy', value: 'snappy' },
            { name: 'LZ4', value: 'lz4' },
            { name: 'ZSTD', value: 'zstd' },
          ],
          default: 'none',
        },
        {
          name: 'partition',
          displayName: 'Partition',
          type: 'number',
          default: -1,
          description: 'Specific partition (-1 for auto)',
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems, credentials } = context;
    const { Kafka, CompressionTypes } = await import('kafkajs');

    const kafka = new Kafka({
      clientId: credentials.clientId || 'agentsmith',
      brokers: credentials.brokers.split(',').map((b: string) => b.trim()),
      ssl: credentials.ssl ? {
        rejectUnauthorized: credentials.rejectUnauthorized !== false,
        ca: credentials.ca,
        cert: credentials.cert,
        key: credentials.key,
      } : undefined,
      sasl: credentials.saslMechanism ? {
        mechanism: credentials.saslMechanism,
        username: credentials.username,
        password: credentials.password,
      } : undefined,
    });

    const producer = kafka.producer();
    await producer.connect();

    const compressionMap: Record<string, any> = {
      none: CompressionTypes.None,
      gzip: CompressionTypes.GZIP,
      snappy: CompressionTypes.Snappy,
      lz4: CompressionTypes.LZ4,
      zstd: CompressionTypes.ZSTD,
    };

    const results: any[] = [];

    try {
      for (const item of inputItems) {
        const message = typeof nodeParams.message === 'string'
          ? nodeParams.message
          : JSON.stringify(item.json);

        const headers: Record<string, string> = {};
        (nodeParams.headers?.header || []).forEach((h: any) => {
          if (h.key) headers[h.key] = h.value;
        });

        const record = {
          topic: nodeParams.topic,
          messages: [{
            key: nodeParams.key || undefined,
            value: message,
            headers,
            partition: nodeParams.options?.partition >= 0 ? nodeParams.options.partition : undefined,
          }],
          acks: nodeParams.options?.acks ?? 1,
          timeout: nodeParams.options?.timeout || 30000,
          compression: compressionMap[nodeParams.options?.compression || 'none'],
        };

        const result = await producer.send(record);

        results.push({
          json: {
            ...item.json,
            _kafka: {
              topic: nodeParams.topic,
              partition: result[0].partition,
              offset: result[0].offset,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    } finally {
      await producer.disconnect();
    }

    return { items: results };
  },
};

export const kafkaConsumerNode: NodeDefinition = {
  name: 'Kafka Consumer',
  type: 'kafkaTrigger',
  category: 'triggers',
  description: 'Trigger workflow on Kafka messages',
  icon: 'inbox',
  version: 1,
  inputs: [],
  outputs: ['main'],
  credentials: ['kafkaCredentials'],
  polling: true,

  properties: [
    {
      name: 'topics',
      displayName: 'Topics',
      type: 'string',
      default: '',
      required: true,
      description: 'Comma-separated list of topics',
    },
    {
      name: 'groupId',
      displayName: 'Consumer Group',
      type: 'string',
      default: 'agentsmith-consumer',
      required: true,
    },
    {
      name: 'fromBeginning',
      displayName: 'From Beginning',
      type: 'boolean',
      default: false,
      description: 'Start consuming from the beginning of topics',
    },
    {
      name: 'maxMessages',
      displayName: 'Max Messages',
      type: 'number',
      default: 10,
      description: 'Maximum messages to process per batch',
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'sessionTimeout',
          displayName: 'Session Timeout (ms)',
          type: 'number',
          default: 30000,
        },
        {
          name: 'heartbeatInterval',
          displayName: 'Heartbeat Interval (ms)',
          type: 'number',
          default: 3000,
        },
        {
          name: 'autoCommit',
          displayName: 'Auto Commit',
          type: 'boolean',
          default: true,
        },
        {
          name: 'parseJson',
          displayName: 'Parse JSON Messages',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, credentials } = context;
    const { Kafka } = await import('kafkajs');

    const kafka = new Kafka({
      clientId: credentials.clientId || 'agentsmith',
      brokers: credentials.brokers.split(',').map((b: string) => b.trim()),
      ssl: credentials.ssl ? {
        rejectUnauthorized: credentials.rejectUnauthorized !== false,
      } : undefined,
      sasl: credentials.saslMechanism ? {
        mechanism: credentials.saslMechanism,
        username: credentials.username,
        password: credentials.password,
      } : undefined,
    });

    const consumer = kafka.consumer({
      groupId: nodeParams.groupId,
      sessionTimeout: nodeParams.options?.sessionTimeout || 30000,
      heartbeatInterval: nodeParams.options?.heartbeatInterval || 3000,
    });

    await consumer.connect();

    const topics = nodeParams.topics.split(',').map((t: string) => t.trim());
    await consumer.subscribe({
      topics,
      fromBeginning: nodeParams.fromBeginning,
    });

    const messages: any[] = [];
    const maxMessages = nodeParams.maxMessages || 10;

    await consumer.run({
      autoCommit: nodeParams.options?.autoCommit !== false,
      eachMessage: async ({ topic, partition, message }) => {
        if (messages.length >= maxMessages) return;

        let value = message.value?.toString();

        if (nodeParams.options?.parseJson && value) {
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string
          }
        }

        messages.push({
          json: {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString(),
            value,
            headers: Object.fromEntries(
              Object.entries(message.headers || {}).map(([k, v]) => [k, v?.toString()])
            ),
            timestamp: message.timestamp,
          },
        });
      },
    });

    // Wait for messages (with timeout)
    await new Promise(resolve => setTimeout(resolve, 5000));
    await consumer.disconnect();

    return { items: messages.length > 0 ? messages : [] };
  },
};

// ==================== RABBITMQ NODES ====================

export const rabbitMQProducerNode: NodeDefinition = {
  name: 'RabbitMQ Producer',
  type: 'rabbitMqProducer',
  category: 'messaging',
  description: 'Send messages to RabbitMQ queues or exchanges',
  icon: 'send',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],
  credentials: ['rabbitMqCredentials'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Queue', value: 'queue' },
        { name: 'Exchange', value: 'exchange' },
      ],
      default: 'queue',
    },
    {
      name: 'queue',
      displayName: 'Queue Name',
      type: 'string',
      default: '',
      displayOptions: { show: { mode: ['queue'] } },
    },
    {
      name: 'exchange',
      displayName: 'Exchange Name',
      type: 'string',
      default: '',
      displayOptions: { show: { mode: ['exchange'] } },
    },
    {
      name: 'routingKey',
      displayName: 'Routing Key',
      type: 'string',
      default: '',
      displayOptions: { show: { mode: ['exchange'] } },
    },
    {
      name: 'message',
      displayName: 'Message',
      type: 'string',
      default: '={{ JSON.stringify($json) }}',
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'persistent',
          displayName: 'Persistent',
          type: 'boolean',
          default: true,
        },
        {
          name: 'contentType',
          displayName: 'Content Type',
          type: 'string',
          default: 'application/json',
        },
        {
          name: 'expiration',
          displayName: 'Expiration (ms)',
          type: 'string',
          default: '',
        },
        {
          name: 'priority',
          displayName: 'Priority (0-9)',
          type: 'number',
          default: 0,
        },
        {
          name: 'correlationId',
          displayName: 'Correlation ID',
          type: 'string',
          default: '',
        },
        {
          name: 'replyTo',
          displayName: 'Reply To',
          type: 'string',
          default: '',
        },
      ],
    },
    {
      name: 'headers',
      displayName: 'Headers',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [{
        name: 'header',
        displayName: 'Header',
        values: [
          { name: 'key', displayName: 'Key', type: 'string', default: '' },
          { name: 'value', displayName: 'Value', type: 'string', default: '' },
        ],
      }],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems, credentials } = context;
    const amqp = await import('amqplib');

    const connectionUrl = credentials.url ||
      `amqp://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 5672}${credentials.vhost || '/'}`;

    const connection = await amqp.connect(connectionUrl);
    const channel = await connection.createChannel();

    const results: any[] = [];

    try {
      for (const item of inputItems) {
        const message = typeof nodeParams.message === 'string'
          ? nodeParams.message
          : JSON.stringify(item.json);

        const headers: Record<string, string> = {};
        (nodeParams.headers?.header || []).forEach((h: any) => {
          if (h.key) headers[h.key] = h.value;
        });

        const options = {
          persistent: nodeParams.options?.persistent !== false,
          contentType: nodeParams.options?.contentType || 'application/json',
          expiration: nodeParams.options?.expiration || undefined,
          priority: nodeParams.options?.priority || undefined,
          correlationId: nodeParams.options?.correlationId || undefined,
          replyTo: nodeParams.options?.replyTo || undefined,
          headers,
        };

        if (nodeParams.mode === 'queue') {
          await channel.assertQueue(nodeParams.queue, { durable: true });
          channel.sendToQueue(nodeParams.queue, Buffer.from(message), options);
        } else {
          channel.publish(
            nodeParams.exchange,
            nodeParams.routingKey || '',
            Buffer.from(message),
            options
          );
        }

        results.push({
          json: {
            ...item.json,
            _rabbitmq: {
              mode: nodeParams.mode,
              destination: nodeParams.mode === 'queue' ? nodeParams.queue : nodeParams.exchange,
              routingKey: nodeParams.routingKey,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    } finally {
      await channel.close();
      await connection.close();
    }

    return { items: results };
  },
};

export const rabbitMQConsumerNode: NodeDefinition = {
  name: 'RabbitMQ Consumer',
  type: 'rabbitMqTrigger',
  category: 'triggers',
  description: 'Trigger workflow on RabbitMQ messages',
  icon: 'inbox',
  version: 1,
  inputs: [],
  outputs: ['main'],
  credentials: ['rabbitMqCredentials'],
  polling: true,

  properties: [
    {
      name: 'queue',
      displayName: 'Queue Name',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'maxMessages',
      displayName: 'Max Messages',
      type: 'number',
      default: 10,
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'autoAck',
          displayName: 'Auto Acknowledge',
          type: 'boolean',
          default: true,
        },
        {
          name: 'prefetch',
          displayName: 'Prefetch Count',
          type: 'number',
          default: 10,
        },
        {
          name: 'parseJson',
          displayName: 'Parse JSON Messages',
          type: 'boolean',
          default: true,
        },
        {
          name: 'exclusive',
          displayName: 'Exclusive Consumer',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, credentials } = context;
    const amqp = await import('amqplib');

    const connectionUrl = credentials.url ||
      `amqp://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 5672}${credentials.vhost || '/'}`;

    const connection = await amqp.connect(connectionUrl);
    const channel = await connection.createChannel();

    await channel.assertQueue(nodeParams.queue, { durable: true });
    await channel.prefetch(nodeParams.options?.prefetch || 10);

    const messages: any[] = [];
    const maxMessages = nodeParams.maxMessages || 10;

    return new Promise(async (resolve) => {
      const timeout = setTimeout(async () => {
        await channel.close();
        await connection.close();
        resolve({ items: messages });
      }, 5000);

      await channel.consume(
        nodeParams.queue,
        (msg) => {
          if (!msg) return;

          let content = msg.content.toString();

          if (nodeParams.options?.parseJson) {
            try {
              content = JSON.parse(content);
            } catch {
              // Keep as string
            }
          }

          messages.push({
            json: {
              content,
              fields: {
                deliveryTag: msg.fields.deliveryTag,
                redelivered: msg.fields.redelivered,
                exchange: msg.fields.exchange,
                routingKey: msg.fields.routingKey,
              },
              properties: msg.properties,
            },
          });

          if (nodeParams.options?.autoAck !== false) {
            channel.ack(msg);
          }

          if (messages.length >= maxMessages) {
            clearTimeout(timeout);
            channel.close().then(() => connection.close());
            resolve({ items: messages });
          }
        },
        {
          noAck: false,
          exclusive: nodeParams.options?.exclusive || false,
        }
      );
    });
  },
};

// ==================== AWS SQS NODES ====================

export const sqsProducerNode: NodeDefinition = {
  name: 'AWS SQS Send',
  type: 'sqsSend',
  category: 'messaging',
  description: 'Send messages to AWS SQS queues',
  icon: 'send',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],
  credentials: ['awsCredentials'],

  properties: [
    {
      name: 'queueUrl',
      displayName: 'Queue URL',
      type: 'string',
      default: '',
      required: true,
      description: 'Full SQS queue URL',
    },
    {
      name: 'message',
      displayName: 'Message Body',
      type: 'string',
      default: '={{ JSON.stringify($json) }}',
    },
    {
      name: 'messageGroupId',
      displayName: 'Message Group ID',
      type: 'string',
      default: '',
      description: 'Required for FIFO queues',
    },
    {
      name: 'messageDeduplicationId',
      displayName: 'Deduplication ID',
      type: 'string',
      default: '',
      description: 'For FIFO queues without content-based deduplication',
    },
    {
      name: 'delaySeconds',
      displayName: 'Delay (seconds)',
      type: 'number',
      default: 0,
      description: 'Delay before message becomes available (0-900)',
    },
    {
      name: 'attributes',
      displayName: 'Message Attributes',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [{
        name: 'attribute',
        displayName: 'Attribute',
        values: [
          { name: 'name', displayName: 'Name', type: 'string', default: '' },
          { name: 'value', displayName: 'Value', type: 'string', default: '' },
          {
            name: 'type', displayName: 'Type', type: 'options',
            options: [
              { name: 'String', value: 'String' },
              { name: 'Number', value: 'Number' },
              { name: 'Binary', value: 'Binary' },
            ],
            default: 'String',
          },
        ],
      }],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems, credentials } = context;
    const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');

    const client = new SQSClient({
      region: credentials.region || 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const results: any[] = [];

    for (const item of inputItems) {
      const message = typeof nodeParams.message === 'string'
        ? nodeParams.message
        : JSON.stringify(item.json);

      const messageAttributes: Record<string, any> = {};
      (nodeParams.attributes?.attribute || []).forEach((attr: any) => {
        if (attr.name) {
          messageAttributes[attr.name] = {
            DataType: attr.type || 'String',
            StringValue: attr.type === 'Binary' ? undefined : String(attr.value),
            BinaryValue: attr.type === 'Binary' ? Buffer.from(attr.value) : undefined,
          };
        }
      });

      const command = new SendMessageCommand({
        QueueUrl: nodeParams.queueUrl,
        MessageBody: message,
        DelaySeconds: nodeParams.delaySeconds || 0,
        MessageGroupId: nodeParams.messageGroupId || undefined,
        MessageDeduplicationId: nodeParams.messageDeduplicationId || undefined,
        MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
      });

      const response = await client.send(command);

      results.push({
        json: {
          ...item.json,
          _sqs: {
            messageId: response.MessageId,
            sequenceNumber: response.SequenceNumber,
            md5: response.MD5OfMessageBody,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return { items: results };
  },
};

export const sqsConsumerNode: NodeDefinition = {
  name: 'AWS SQS Receive',
  type: 'sqsTrigger',
  category: 'triggers',
  description: 'Trigger workflow on AWS SQS messages',
  icon: 'inbox',
  version: 1,
  inputs: [],
  outputs: ['main'],
  credentials: ['awsCredentials'],
  polling: true,

  properties: [
    {
      name: 'queueUrl',
      displayName: 'Queue URL',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'maxMessages',
      displayName: 'Max Messages',
      type: 'number',
      default: 10,
      description: 'Maximum messages to receive (1-10)',
    },
    {
      name: 'waitTimeSeconds',
      displayName: 'Wait Time (seconds)',
      type: 'number',
      default: 20,
      description: 'Long polling wait time (0-20)',
    },
    {
      name: 'visibilityTimeout',
      displayName: 'Visibility Timeout (seconds)',
      type: 'number',
      default: 30,
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'deleteAfterReceive',
          displayName: 'Delete After Receive',
          type: 'boolean',
          default: true,
        },
        {
          name: 'parseJson',
          displayName: 'Parse JSON Messages',
          type: 'boolean',
          default: true,
        },
        {
          name: 'attributeNames',
          displayName: 'Attribute Names',
          type: 'string',
          default: 'All',
          description: 'Comma-separated or "All"',
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, credentials } = context;
    const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = await import('@aws-sdk/client-sqs');

    const client = new SQSClient({
      region: credentials.region || 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const attributeNames = nodeParams.options?.attributeNames === 'All'
      ? ['All']
      : (nodeParams.options?.attributeNames || 'All').split(',').map((a: string) => a.trim());

    const command = new ReceiveMessageCommand({
      QueueUrl: nodeParams.queueUrl,
      MaxNumberOfMessages: Math.min(nodeParams.maxMessages || 10, 10),
      WaitTimeSeconds: nodeParams.waitTimeSeconds || 20,
      VisibilityTimeout: nodeParams.visibilityTimeout || 30,
      AttributeNames: attributeNames,
      MessageAttributeNames: ['All'],
    });

    const response = await client.send(command);
    const messages: any[] = [];

    if (response.Messages) {
      for (const msg of response.Messages) {
        let body = msg.Body;

        if (nodeParams.options?.parseJson && body) {
          try {
            body = JSON.parse(body);
          } catch {
            // Keep as string
          }
        }

        messages.push({
          json: {
            messageId: msg.MessageId,
            receiptHandle: msg.ReceiptHandle,
            body,
            attributes: msg.Attributes,
            messageAttributes: msg.MessageAttributes,
            md5: msg.MD5OfBody,
          },
        });

        // Delete message if configured
        if (nodeParams.options?.deleteAfterReceive !== false) {
          await client.send(new DeleteMessageCommand({
            QueueUrl: nodeParams.queueUrl,
            ReceiptHandle: msg.ReceiptHandle!,
          }));
        }
      }
    }

    return { items: messages };
  },
};

// Batch delete for SQS
export const sqsBatchDeleteNode: NodeDefinition = {
  name: 'AWS SQS Delete',
  type: 'sqsDelete',
  category: 'messaging',
  description: 'Delete messages from AWS SQS queue',
  icon: 'trash',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],
  credentials: ['awsCredentials'],

  properties: [
    {
      name: 'queueUrl',
      displayName: 'Queue URL',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'receiptHandleField',
      displayName: 'Receipt Handle Field',
      type: 'string',
      default: 'receiptHandle',
      description: 'Field containing the receipt handle',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems, credentials } = context;
    const { SQSClient, DeleteMessageBatchCommand } = await import('@aws-sdk/client-sqs');

    const client = new SQSClient({
      region: credentials.region || 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const entries = inputItems.map((item, idx) => ({
      Id: String(idx),
      ReceiptHandle: item.json[nodeParams.receiptHandleField],
    })).filter(e => e.ReceiptHandle);

    // Batch in groups of 10
    const results: any[] = [];
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);

      const command = new DeleteMessageBatchCommand({
        QueueUrl: nodeParams.queueUrl,
        Entries: batch,
      });

      const response = await client.send(command);

      results.push({
        json: {
          successful: response.Successful?.length || 0,
          failed: response.Failed?.length || 0,
          failures: response.Failed,
        },
      });
    }

    return { items: results };
  },
};

export const messageQueueNodes = [
  kafkaProducerNode,
  kafkaConsumerNode,
  rabbitMQProducerNode,
  rabbitMQConsumerNode,
  sqsProducerNode,
  sqsConsumerNode,
  sqsBatchDeleteNode,
];

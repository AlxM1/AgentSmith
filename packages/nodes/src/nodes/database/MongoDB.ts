import { createProgrammaticNode } from '@agentsmith/shared';

export const MongoDB = createProgrammaticNode({
  name: 'MongoDB',
  displayName: 'MongoDB',
  description: 'Perform operations on MongoDB',
  icon: 'file:mongodb.svg',
  group: ['database'],
  version: 1,
  defaults: { name: 'MongoDB' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'mongoDbApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Find', value: 'find' },
        { name: 'Find One', value: 'findOne' },
        { name: 'Insert', value: 'insert' },
        { name: 'Insert Many', value: 'insertMany' },
        { name: 'Update', value: 'update' },
        { name: 'Update Many', value: 'updateMany' },
        { name: 'Delete', value: 'delete' },
        { name: 'Delete Many', value: 'deleteMany' },
        { name: 'Aggregate', value: 'aggregate' },
        { name: 'Count', value: 'count' },
      ],
      default: 'find',
    },
    {
      displayName: 'Collection',
      name: 'collection',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Query (JSON)',
      name: 'query',
      type: 'json',
      default: '{}',
      displayOptions: { show: { operation: ['find', 'findOne', 'update', 'updateMany', 'delete', 'deleteMany', 'count'] } },
      description: 'MongoDB query filter',
    },
    {
      displayName: 'Document (JSON)',
      name: 'document',
      type: 'json',
      default: '{}',
      displayOptions: { show: { operation: ['insert', 'findOne'] } },
    },
    {
      displayName: 'Documents (JSON Array)',
      name: 'documents',
      type: 'json',
      default: '[]',
      displayOptions: { show: { operation: ['insertMany'] } },
    },
    {
      displayName: 'Update (JSON)',
      name: 'update',
      type: 'json',
      default: '{ "$set": {} }',
      displayOptions: { show: { operation: ['update', 'updateMany'] } },
    },
    {
      displayName: 'Pipeline (JSON Array)',
      name: 'pipeline',
      type: 'json',
      default: '[]',
      displayOptions: { show: { operation: ['aggregate'] } },
      description: 'Aggregation pipeline stages',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Limit',
          name: 'limit',
          type: 'number',
          default: 0,
          description: 'Number of documents to return (0 = no limit)',
        },
        {
          displayName: 'Skip',
          name: 'skip',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Sort (JSON)',
          name: 'sort',
          type: 'json',
          default: '{}',
          description: 'Sort order (e.g., { "createdAt": -1 })',
        },
        {
          displayName: 'Projection (JSON)',
          name: 'projection',
          type: 'json',
          default: '{}',
          description: 'Fields to include/exclude',
        },
        {
          displayName: 'Upsert',
          name: 'upsert',
          type: 'boolean',
          default: false,
          description: 'Insert if document does not exist',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('mongoDbApi');

    // In production, this would use mongodb package
    const client = await createMongoDBConnection(credentials);

    try {
      const dbName = credentials.database as string;
      const db = client.db(dbName);

      for (let i = 0; i < items.length; i++) {
        const operation = this.getNodeParameter('operation', i) as string;
        const collectionName = this.getNodeParameter('collection', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        const collection = db.collection(collectionName);

        try {
          let result: any;

          switch (operation) {
            case 'find': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              const sort = options.sort ? JSON.parse(options.sort) : {};
              const projection = options.projection ? JSON.parse(options.projection) : {};

              let cursor = collection.find(query, { projection });

              if (Object.keys(sort).length) cursor = cursor.sort(sort);
              if (options.skip) cursor = cursor.skip(options.skip);
              if (options.limit) cursor = cursor.limit(options.limit);

              result = await cursor.toArray();
              break;
            }

            case 'findOne': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              const projection = options.projection ? JSON.parse(options.projection) : {};
              result = await collection.findOne(query, { projection });
              break;
            }

            case 'insert': {
              const document = JSON.parse(this.getNodeParameter('document', i) as string);
              result = await collection.insertOne(document);
              result = { ...result, document };
              break;
            }

            case 'insertMany': {
              const documents = JSON.parse(this.getNodeParameter('documents', i) as string);
              result = await collection.insertMany(documents);
              break;
            }

            case 'update': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              const update = JSON.parse(this.getNodeParameter('update', i) as string);
              result = await collection.updateOne(query, update, { upsert: options.upsert });
              break;
            }

            case 'updateMany': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              const update = JSON.parse(this.getNodeParameter('update', i) as string);
              result = await collection.updateMany(query, update, { upsert: options.upsert });
              break;
            }

            case 'delete': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              result = await collection.deleteOne(query);
              break;
            }

            case 'deleteMany': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              result = await collection.deleteMany(query);
              break;
            }

            case 'aggregate': {
              const pipeline = JSON.parse(this.getNodeParameter('pipeline', i) as string);
              result = await collection.aggregate(pipeline).toArray();
              break;
            }

            case 'count': {
              const query = JSON.parse(this.getNodeParameter('query', i) as string);
              result = { count: await collection.countDocuments(query) };
              break;
            }
          }

          const rows = Array.isArray(result) ? result : [result];
          for (const row of rows) {
            if (row !== null) {
              returnData.push({ json: row });
            }
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
      await client.close();
    }

    return [returnData];
  },
});

// Mock MongoDB connection for typing - replace with actual mongodb in production
async function createMongoDBConnection(credentials: any) {
  return {
    db: (name: string) => ({
      collection: (collectionName: string) => ({
        find: (query: any, options?: any) => ({
          sort: function(s: any) { return this; },
          skip: function(n: number) { return this; },
          limit: function(n: number) { return this; },
          toArray: async () => [],
        }),
        findOne: async (query: any, options?: any) => null,
        insertOne: async (doc: any) => ({ insertedId: 'mock-id' }),
        insertMany: async (docs: any[]) => ({ insertedCount: docs.length }),
        updateOne: async (query: any, update: any, options?: any) => ({ modifiedCount: 1 }),
        updateMany: async (query: any, update: any, options?: any) => ({ modifiedCount: 1 }),
        deleteOne: async (query: any) => ({ deletedCount: 1 }),
        deleteMany: async (query: any) => ({ deletedCount: 1 }),
        aggregate: (pipeline: any[]) => ({ toArray: async () => [] }),
        countDocuments: async (query: any) => 0,
      }),
    }),
    close: async () => {},
  };
}

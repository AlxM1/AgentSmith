import { createProgrammaticNode } from '@agentsmith/shared';

export const Pinecone = createProgrammaticNode({
  name: 'Pinecone',
  displayName: 'Pinecone',
  description: 'Vector database operations with Pinecone',
  icon: 'file:pinecone.svg',
  group: ['vectordb', 'ai'],
  version: 1,
  defaults: { name: 'Pinecone' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'pineconeApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upsert Vectors', value: 'upsert' },
        { name: 'Query (Similarity Search)', value: 'query' },
        { name: 'Fetch Vectors', value: 'fetch' },
        { name: 'Delete Vectors', value: 'delete' },
        { name: 'Describe Index Stats', value: 'describeIndexStats' },
        { name: 'List Indexes', value: 'listIndexes' },
      ],
      default: 'query',
    },
    {
      displayName: 'Index Name',
      name: 'indexName',
      type: 'string',
      default: '',
      required: true,
      displayOptions: { show: { operation: ['upsert', 'query', 'fetch', 'delete', 'describeIndexStats'] } },
    },
    {
      displayName: 'Namespace',
      name: 'namespace',
      type: 'string',
      default: '',
      description: 'Optional namespace to isolate vectors',
    },
    {
      displayName: 'Vector',
      name: 'vector',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['query'] } },
      description: 'Query vector as JSON array or field reference',
    },
    {
      displayName: 'Vectors to Upsert',
      name: 'vectors',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['upsert'] } },
      options: [
        {
          displayName: 'Vector',
          name: 'vector',
          values: [
            { displayName: 'ID', name: 'id', type: 'string', default: '' },
            { displayName: 'Values', name: 'values', type: 'string', default: '', description: 'Vector as JSON array' },
            { displayName: 'Metadata (JSON)', name: 'metadata', type: 'json', default: '{}' },
          ],
        },
      ],
    },
    {
      displayName: 'Vector IDs',
      name: 'ids',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['fetch', 'delete'] } },
      description: 'Comma-separated list of vector IDs',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Top K',
          name: 'topK',
          type: 'number',
          default: 10,
          description: 'Number of results to return',
        },
        {
          displayName: 'Include Values',
          name: 'includeValues',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Include Metadata',
          name: 'includeMetadata',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Filter (JSON)',
          name: 'filter',
          type: 'json',
          default: '{}',
          description: 'Metadata filter for query',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('pineconeApi');
    const apiKey = credentials.apiKey as string;
    const environment = credentials.environment as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        if (operation === 'listIndexes') {
          result = await pineconeRequest('GET', `https://controller.${environment}.pinecone.io/databases`, null, apiKey);
        } else {
          const indexName = this.getNodeParameter('indexName', i) as string;
          const namespace = this.getNodeParameter('namespace', i) as string;
          const indexHost = `https://${indexName}-${environment}.svc.${environment}.pinecone.io`;

          switch (operation) {
            case 'upsert': {
              const vectorsData = this.getNodeParameter('vectors', i) as any;
              const vectors = (vectorsData.vector || []).map((v: any) => ({
                id: v.id,
                values: JSON.parse(v.values),
                metadata: v.metadata ? JSON.parse(v.metadata) : undefined,
              }));

              result = await pineconeRequest('POST', `${indexHost}/vectors/upsert`, {
                vectors,
                namespace: namespace || undefined,
              }, apiKey);
              break;
            }

            case 'query': {
              const vectorStr = this.getNodeParameter('vector', i) as string;
              const vector = JSON.parse(vectorStr);

              result = await pineconeRequest('POST', `${indexHost}/query`, {
                vector,
                topK: options.topK || 10,
                includeValues: options.includeValues || false,
                includeMetadata: options.includeMetadata !== false,
                filter: options.filter ? JSON.parse(options.filter) : undefined,
                namespace: namespace || undefined,
              }, apiKey);
              break;
            }

            case 'fetch': {
              const ids = (this.getNodeParameter('ids', i) as string).split(',').map(id => id.trim());
              const params = new URLSearchParams();
              ids.forEach(id => params.append('ids', id));
              if (namespace) params.append('namespace', namespace);

              result = await pineconeRequest('GET', `${indexHost}/vectors/fetch?${params}`, null, apiKey);
              break;
            }

            case 'delete': {
              const ids = (this.getNodeParameter('ids', i) as string).split(',').map(id => id.trim());

              result = await pineconeRequest('POST', `${indexHost}/vectors/delete`, {
                ids,
                namespace: namespace || undefined,
              }, apiKey);
              break;
            }

            case 'describeIndexStats': {
              result = await pineconeRequest('POST', `${indexHost}/describe_index_stats`, {}, apiKey);
              break;
            }
          }
        }

        returnData.push({ json: result });
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

export const Qdrant = createProgrammaticNode({
  name: 'Qdrant',
  displayName: 'Qdrant',
  description: 'Vector database operations with Qdrant',
  icon: 'file:qdrant.svg',
  group: ['vectordb', 'ai'],
  version: 1,
  defaults: { name: 'Qdrant' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'qdrantApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upsert Points', value: 'upsert' },
        { name: 'Search', value: 'search' },
        { name: 'Get Points', value: 'get' },
        { name: 'Delete Points', value: 'delete' },
        { name: 'List Collections', value: 'listCollections' },
        { name: 'Create Collection', value: 'createCollection' },
        { name: 'Collection Info', value: 'collectionInfo' },
      ],
      default: 'search',
    },
    {
      displayName: 'Collection Name',
      name: 'collectionName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upsert', 'search', 'get', 'delete', 'createCollection', 'collectionInfo'] } },
    },
    {
      displayName: 'Vector',
      name: 'vector',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
      description: 'Query vector as JSON array',
    },
    {
      displayName: 'Points',
      name: 'points',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['upsert'] } },
      options: [
        {
          displayName: 'Point',
          name: 'point',
          values: [
            { displayName: 'ID', name: 'id', type: 'string', default: '' },
            { displayName: 'Vector', name: 'vector', type: 'string', default: '', description: 'Vector as JSON array' },
            { displayName: 'Payload (JSON)', name: 'payload', type: 'json', default: '{}' },
          ],
        },
      ],
    },
    {
      displayName: 'Point IDs',
      name: 'ids',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['get', 'delete'] } },
      description: 'Comma-separated list of point IDs',
    },
    {
      displayName: 'Vector Size',
      name: 'vectorSize',
      type: 'number',
      default: 1536,
      displayOptions: { show: { operation: ['createCollection'] } },
    },
    {
      displayName: 'Distance',
      name: 'distance',
      type: 'options',
      options: [
        { name: 'Cosine', value: 'Cosine' },
        { name: 'Euclidean', value: 'Euclid' },
        { name: 'Dot Product', value: 'Dot' },
      ],
      default: 'Cosine',
      displayOptions: { show: { operation: ['createCollection'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Limit', name: 'limit', type: 'number', default: 10 },
        { displayName: 'With Payload', name: 'withPayload', type: 'boolean', default: true },
        { displayName: 'With Vector', name: 'withVector', type: 'boolean', default: false },
        { displayName: 'Score Threshold', name: 'scoreThreshold', type: 'number', default: 0 },
        { displayName: 'Filter (JSON)', name: 'filter', type: 'json', default: '{}' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('qdrantApi');
    const baseUrl = credentials.url as string;
    const apiKey = credentials.apiKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'listCollections': {
            result = await qdrantRequest('GET', `${baseUrl}/collections`, null, apiKey);
            break;
          }

          case 'createCollection': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            const vectorSize = this.getNodeParameter('vectorSize', i) as number;
            const distance = this.getNodeParameter('distance', i) as string;

            result = await qdrantRequest('PUT', `${baseUrl}/collections/${collectionName}`, {
              vectors: { size: vectorSize, distance },
            }, apiKey);
            break;
          }

          case 'collectionInfo': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            result = await qdrantRequest('GET', `${baseUrl}/collections/${collectionName}`, null, apiKey);
            break;
          }

          case 'upsert': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            const pointsData = this.getNodeParameter('points', i) as any;
            const points = (pointsData.point || []).map((p: any) => ({
              id: isNaN(Number(p.id)) ? p.id : Number(p.id),
              vector: JSON.parse(p.vector),
              payload: p.payload ? JSON.parse(p.payload) : undefined,
            }));

            result = await qdrantRequest('PUT', `${baseUrl}/collections/${collectionName}/points`, {
              points,
            }, apiKey);
            break;
          }

          case 'search': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            const vectorStr = this.getNodeParameter('vector', i) as string;
            const vector = JSON.parse(vectorStr);

            const body: any = {
              vector,
              limit: options.limit || 10,
              with_payload: options.withPayload !== false,
              with_vector: options.withVector || false,
            };

            if (options.scoreThreshold) body.score_threshold = options.scoreThreshold;
            if (options.filter && options.filter !== '{}') body.filter = JSON.parse(options.filter);

            result = await qdrantRequest('POST', `${baseUrl}/collections/${collectionName}/points/search`, body, apiKey);
            break;
          }

          case 'get': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            const ids = (this.getNodeParameter('ids', i) as string).split(',').map(id => {
              const trimmed = id.trim();
              return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
            });

            result = await qdrantRequest('POST', `${baseUrl}/collections/${collectionName}/points`, {
              ids,
              with_payload: options.withPayload !== false,
              with_vector: options.withVector || false,
            }, apiKey);
            break;
          }

          case 'delete': {
            const collectionName = this.getNodeParameter('collectionName', i) as string;
            const ids = (this.getNodeParameter('ids', i) as string).split(',').map(id => {
              const trimmed = id.trim();
              return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
            });

            result = await qdrantRequest('POST', `${baseUrl}/collections/${collectionName}/points/delete`, {
              points: ids,
            }, apiKey);
            break;
          }
        }

        returnData.push({ json: result });
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

async function pineconeRequest(method: string, url: string, body: any, apiKey: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinecone API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function qdrantRequest(method: string, url: string, body: any, apiKey: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Qdrant API error: ${response.status} - ${error}`);
  }

  return response.json();
}

import { createProgrammaticNode } from '@agentsmith/shared';

export const GraphQL = createProgrammaticNode({
  name: 'GraphQL',
  displayName: 'GraphQL',
  description: 'Make GraphQL API requests',
  icon: 'file:graphql.svg',
  group: ['developer'],
  version: 1,
  defaults: { name: 'GraphQL' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'httpBasicAuth', required: false },
    { name: 'httpHeaderAuth', required: false },
  ],
  properties: [
    {
      displayName: 'Endpoint',
      name: 'endpoint',
      type: 'string',
      default: '',
      placeholder: 'https://api.example.com/graphql',
      required: true,
    },
    {
      displayName: 'Request Format',
      name: 'requestFormat',
      type: 'options',
      options: [
        { name: 'Query Editor', value: 'editor' },
        { name: 'JSON', value: 'json' },
      ],
      default: 'editor',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      displayOptions: { show: { requestFormat: ['editor'] } },
      placeholder: 'query {\n  users {\n    id\n    name\n  }\n}',
    },
    {
      displayName: 'Variables (JSON)',
      name: 'variables',
      type: 'json',
      default: '{}',
      displayOptions: { show: { requestFormat: ['editor'] } },
    },
    {
      displayName: 'Operation Name',
      name: 'operationName',
      type: 'string',
      default: '',
      displayOptions: { show: { requestFormat: ['editor'] } },
    },
    {
      displayName: 'JSON Body',
      name: 'jsonBody',
      type: 'json',
      default: '{\n  "query": "",\n  "variables": {}\n}',
      displayOptions: { show: { requestFormat: ['json'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Headers',
          name: 'headers',
          type: 'fixedCollection',
          typeOptions: { multipleValues: true },
          default: {},
          options: [
            {
              displayName: 'Header',
              name: 'header',
              values: [
                { displayName: 'Name', name: 'name', type: 'string', default: '' },
                { displayName: 'Value', name: 'value', type: 'string', default: '' },
              ],
            },
          ],
        },
        { displayName: 'Timeout', name: 'timeout', type: 'number', default: 30000 },
        { displayName: 'Include Extensions', name: 'includeExtensions', type: 'boolean', default: false },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const endpoint = this.getNodeParameter('endpoint', i) as string;
        const requestFormat = this.getNodeParameter('requestFormat', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        let body: any;

        if (requestFormat === 'editor') {
          const query = this.getNodeParameter('query', i) as string;
          const variables = this.getNodeParameter('variables', i) as string;
          const operationName = this.getNodeParameter('operationName', i) as string;

          body = { query };
          if (variables && variables !== '{}') body.variables = JSON.parse(variables);
          if (operationName) body.operationName = operationName;
        } else {
          body = JSON.parse(this.getNodeParameter('jsonBody', i) as string);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add custom headers
        if (options.headers?.header) {
          for (const header of options.headers.header) {
            headers[header.name] = header.value;
          }
        }

        // Add auth headers if credentials are configured
        try {
          const basicAuth = await this.getCredentials('httpBasicAuth');
          if (basicAuth) {
            const auth = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
          }
        } catch {}

        try {
          const headerAuth = await this.getCredentials('httpHeaderAuth');
          if (headerAuth) {
            headers[headerAuth.name as string] = headerAuth.value as string;
          }
        } catch {}

        const controller = new AbortController();
        const timeout = options.timeout || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data = await response.json();

          if (data.errors && data.errors.length > 0) {
            if (this.continueOnFail()) {
              returnData.push({ json: { errors: data.errors, data: data.data } });
              continue;
            }
            throw new Error(data.errors.map((e: any) => e.message).join(', '));
          }

          const result: any = { data: data.data };
          if (options.includeExtensions && data.extensions) {
            result.extensions = data.extensions;
          }

          returnData.push({ json: result });
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
          }
          throw error;
        }
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

export const RSSFeed = createProgrammaticNode({
  name: 'RSSFeed',
  displayName: 'RSS Feed',
  description: 'Read and parse RSS/Atom feeds',
  icon: 'fa:rss',
  group: ['developer'],
  version: 1,
  defaults: { name: 'RSS Feed' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Read Feed', value: 'read' },
      ],
      default: 'read',
    },
    {
      displayName: 'Feed URL',
      name: 'feedUrl',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Items', name: 'maxItems', type: 'number', default: 0, description: '0 = all items' },
        { displayName: 'Include Content', name: 'includeContent', type: 'boolean', default: true },
        { displayName: 'Date Field', name: 'dateField', type: 'options', options: [
          { name: 'Published Date', value: 'pubDate' },
          { name: 'Updated Date', value: 'updated' },
        ], default: 'pubDate' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const feedUrl = this.getNodeParameter('feedUrl', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        const response = await fetch(feedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status}`);
        }

        const xml = await response.text();
        const feed = parseRSSFeed(xml, options);

        let feedItems = feed.items;
        if (options.maxItems && options.maxItems > 0) {
          feedItems = feedItems.slice(0, options.maxItems);
        }

        // Return feed metadata as first item, then each item
        returnData.push({
          json: {
            feedTitle: feed.title,
            feedDescription: feed.description,
            feedLink: feed.link,
            feedLastUpdated: feed.lastUpdated,
            itemCount: feedItems.length,
          },
        });

        for (const item of feedItems) {
          returnData.push({ json: item });
        }
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

export const FTP = createProgrammaticNode({
  name: 'FTP',
  displayName: 'FTP',
  description: 'Transfer files via FTP/SFTP',
  icon: 'fa:server',
  group: ['developer'],
  version: 1,
  defaults: { name: 'FTP' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'ftpApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upload File', value: 'upload' },
        { name: 'Download File', value: 'download' },
        { name: 'List Files', value: 'list' },
        { name: 'Delete File', value: 'delete' },
        { name: 'Create Directory', value: 'mkdir' },
        { name: 'Rename', value: 'rename' },
      ],
      default: 'list',
    },
    {
      displayName: 'Path',
      name: 'path',
      type: 'string',
      default: '/',
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['upload', 'download'] } },
    },
    {
      displayName: 'New Path',
      name: 'newPath',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['rename'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Recursive', name: 'recursive', type: 'boolean', default: false },
        { displayName: 'Overwrite', name: 'overwrite', type: 'boolean', default: false },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('ftpApi');

    // Note: FTP operations require an actual FTP library like basic-ftp
    // This is a mock implementation showing the structure

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const path = this.getNodeParameter('path', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        // Mock FTP connection
        const ftpClient = await connectFTP(credentials);

        try {
          switch (operation) {
            case 'list': {
              result = await ftpClient.list(path);
              break;
            }

            case 'upload': {
              const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
              const binaryData = items[i].binary?.[binaryProperty];
              if (!binaryData) throw new Error('No binary data found');

              await ftpClient.upload(path, Buffer.from(binaryData.data, 'base64'));
              result = { success: true, path };
              break;
            }

            case 'download': {
              const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
              const data = await ftpClient.download(path);

              returnData.push({
                json: { path },
                binary: {
                  [binaryProperty]: {
                    data: data.toString('base64'),
                    mimeType: 'application/octet-stream',
                    fileName: path.split('/').pop() || 'download',
                  },
                },
              });
              continue;
            }

            case 'delete': {
              await ftpClient.delete(path);
              result = { success: true, path };
              break;
            }

            case 'mkdir': {
              await ftpClient.mkdir(path, options.recursive);
              result = { success: true, path };
              break;
            }

            case 'rename': {
              const newPath = this.getNodeParameter('newPath', i) as string;
              await ftpClient.rename(path, newPath);
              result = { success: true, oldPath: path, newPath };
              break;
            }
          }
        } finally {
          await ftpClient.close();
        }

        if (result) {
          returnData.push({ json: result });
        }
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

export const ExecuteCommand = createProgrammaticNode({
  name: 'ExecuteCommand',
  displayName: 'Execute Command',
  description: 'Execute shell commands on the server',
  icon: 'fa:terminal',
  group: ['developer'],
  version: 1,
  defaults: { name: 'Execute Command' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Command',
      name: 'command',
      type: 'string',
      default: '',
      required: true,
      description: 'The command to execute',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Working Directory', name: 'cwd', type: 'string', default: '' },
        { displayName: 'Timeout (ms)', name: 'timeout', type: 'number', default: 60000 },
        { displayName: 'Environment Variables', name: 'env', type: 'json', default: '{}' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const command = this.getNodeParameter('command', i) as string;
        const options = this.getNodeParameter('options', i) as any;

        // Note: In production, this would use child_process.exec
        // This is a mock implementation
        const result = await executeShellCommand(command, {
          cwd: options.cwd || process.cwd(),
          timeout: options.timeout || 60000,
          env: options.env ? { ...process.env, ...JSON.parse(options.env) } : process.env,
        });

        returnData.push({
          json: {
            command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
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

export const SSHTunnel = createProgrammaticNode({
  name: 'SSHTunnel',
  displayName: 'SSH',
  description: 'Execute commands over SSH',
  icon: 'fa:key',
  group: ['developer'],
  version: 1,
  defaults: { name: 'SSH' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'sshApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Execute Command', value: 'execute' },
        { name: 'Upload File', value: 'upload' },
        { name: 'Download File', value: 'download' },
      ],
      default: 'execute',
    },
    {
      displayName: 'Command',
      name: 'command',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['execute'] } },
    },
    {
      displayName: 'Remote Path',
      name: 'remotePath',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upload', 'download'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['upload', 'download'] } },
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('sshApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        let result: any;

        // Note: In production, use ssh2 library
        // This is a mock implementation
        const sshClient = await connectSSH(credentials);

        try {
          switch (operation) {
            case 'execute': {
              const command = this.getNodeParameter('command', i) as string;
              result = await sshClient.exec(command);
              break;
            }

            case 'upload': {
              const remotePath = this.getNodeParameter('remotePath', i) as string;
              const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
              const binaryData = items[i].binary?.[binaryProperty];

              if (!binaryData) throw new Error('No binary data found');

              await sshClient.upload(remotePath, Buffer.from(binaryData.data, 'base64'));
              result = { success: true, remotePath };
              break;
            }

            case 'download': {
              const remotePath = this.getNodeParameter('remotePath', i) as string;
              const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

              const data = await sshClient.download(remotePath);

              returnData.push({
                json: { remotePath },
                binary: {
                  [binaryProperty]: {
                    data: data.toString('base64'),
                    mimeType: 'application/octet-stream',
                    fileName: remotePath.split('/').pop() || 'download',
                  },
                },
              });
              continue;
            }
          }
        } finally {
          await sshClient.close();
        }

        if (result) {
          returnData.push({ json: result });
        }
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

// Helper functions
function parseRSSFeed(xml: string, options: any): any {
  // Basic RSS/Atom parser
  const isAtom = xml.includes('<feed');

  const getTagContent = (tag: string, content: string): string => {
    const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    return match ? match[1].trim() : '';
  };

  const getCDATA = (content: string): string => {
    const match = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    return match ? match[1] : content;
  };

  const feed: any = {
    title: '',
    description: '',
    link: '',
    lastUpdated: '',
    items: [],
  };

  if (isAtom) {
    feed.title = getTagContent('title', xml);
    feed.description = getTagContent('subtitle', xml);
    feed.link = xml.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']alternate["']/)?.[1] || '';
    feed.lastUpdated = getTagContent('updated', xml);

    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const entry of entries) {
      feed.items.push({
        title: getCDATA(getTagContent('title', entry)),
        link: entry.match(/<link[^>]*href=["']([^"']*)["']/)?.[1] || '',
        description: getCDATA(getTagContent('summary', entry)),
        content: options.includeContent ? getCDATA(getTagContent('content', entry)) : undefined,
        pubDate: getTagContent('published', entry) || getTagContent('updated', entry),
        author: getTagContent('name', getTagContent('author', entry)),
        id: getTagContent('id', entry),
      });
    }
  } else {
    const channel = xml.match(/<channel[\s\S]*<\/channel>/i)?.[0] || xml;
    feed.title = getCDATA(getTagContent('title', channel));
    feed.description = getCDATA(getTagContent('description', channel));
    feed.link = getTagContent('link', channel);
    feed.lastUpdated = getTagContent('lastBuildDate', channel) || getTagContent('pubDate', channel);

    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const item of items) {
      feed.items.push({
        title: getCDATA(getTagContent('title', item)),
        link: getTagContent('link', item),
        description: getCDATA(getTagContent('description', item)),
        content: options.includeContent ? getCDATA(getTagContent('content:encoded', item)) : undefined,
        pubDate: getTagContent('pubDate', item),
        author: getTagContent('author', item) || getTagContent('dc:creator', item),
        guid: getTagContent('guid', item),
        categories: (item.match(/<category[^>]*>([^<]*)<\/category>/gi) || []).map(c => getCDATA(c.replace(/<\/?category[^>]*>/gi, ''))),
      });
    }
  }

  return feed;
}

// Mock implementations - in production, use actual libraries
async function connectFTP(credentials: any): Promise<any> {
  return {
    list: async (path: string) => [],
    upload: async (path: string, data: Buffer) => {},
    download: async (path: string) => Buffer.from(''),
    delete: async (path: string) => {},
    mkdir: async (path: string, recursive: boolean) => {},
    rename: async (oldPath: string, newPath: string) => {},
    close: async () => {},
  };
}

async function connectSSH(credentials: any): Promise<any> {
  return {
    exec: async (command: string) => ({ stdout: '', stderr: '', exitCode: 0 }),
    upload: async (remotePath: string, data: Buffer) => {},
    download: async (remotePath: string) => Buffer.from(''),
    close: async () => {},
  };
}

async function executeShellCommand(command: string, options: any): Promise<any> {
  // Mock implementation - in production use child_process
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
}

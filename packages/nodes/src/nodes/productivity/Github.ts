import { createProgrammaticNode } from '@agentsmith/shared';
import type { INodeExecutionData, IExecuteFunctions } from '@agentsmith/shared';

export const Github = createProgrammaticNode({
  name: 'github',
  displayName: 'GitHub',
  description: 'Interact with GitHub API',
  icon: 'file:github.svg',
  group: ['transform'],
  version: 1,
  defaults: {
    name: 'GitHub',
  },
  credentials: [
    { name: 'githubApi', required: true },
  ],
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      options: [
        { name: 'Repository', value: 'repository' },
        { name: 'Issue', value: 'issue' },
        { name: 'Pull Request', value: 'pullRequest' },
        { name: 'User', value: 'user' },
        { name: 'Organization', value: 'organization' },
        { name: 'File', value: 'file' },
        { name: 'Release', value: 'release' },
      ],
      default: 'repository',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['repository'],
        },
      },
      options: [
        { name: 'Get', value: 'get' },
        { name: 'List', value: 'list' },
        { name: 'Create', value: 'create' },
      ],
      default: 'get',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['issue'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'List', value: 'list' },
        { name: 'Update', value: 'update' },
        { name: 'Add Comment', value: 'comment' },
        { name: 'Close', value: 'close' },
      ],
      default: 'list',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['pullRequest'],
        },
      },
      options: [
        { name: 'Create', value: 'create' },
        { name: 'Get', value: 'get' },
        { name: 'List', value: 'list' },
        { name: 'Merge', value: 'merge' },
        { name: 'Review', value: 'review' },
      ],
      default: 'list',
    },
    {
      displayName: 'Owner',
      name: 'owner',
      type: 'string',
      default: '',
      required: true,
      description: 'Repository owner (username or organization)',
    },
    {
      displayName: 'Repository',
      name: 'repository',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Issue/PR Number',
      name: 'number',
      type: 'number',
      default: 0,
      displayOptions: {
        show: {
          operation: ['get', 'update', 'comment', 'close', 'merge', 'review'],
        },
      },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          operation: ['create'],
          resource: ['issue', 'pullRequest'],
        },
      },
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'string',
      typeOptions: {
        rows: 5,
      },
      default: '',
      displayOptions: {
        show: {
          operation: ['create', 'update', 'comment'],
        },
      },
    },
    {
      displayName: 'Head Branch',
      name: 'head',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          resource: ['pullRequest'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Base Branch',
      name: 'base',
      type: 'string',
      default: 'main',
      displayOptions: {
        show: {
          resource: ['pullRequest'],
          operation: ['create'],
        },
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'State',
          name: 'state',
          type: 'options',
          options: [
            { name: 'Open', value: 'open' },
            { name: 'Closed', value: 'closed' },
            { name: 'All', value: 'all' },
          ],
          default: 'open',
        },
        {
          displayName: 'Labels',
          name: 'labels',
          type: 'string',
          default: '',
          description: 'Comma-separated list of labels',
        },
        {
          displayName: 'Assignees',
          name: 'assignees',
          type: 'string',
          default: '',
          description: 'Comma-separated list of assignees',
        },
        {
          displayName: 'Per Page',
          name: 'per_page',
          type: 'number',
          default: 30,
        },
        {
          displayName: 'Page',
          name: 'page',
          type: 'number',
          default: 1,
        },
      ],
    },
  ],
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('githubApi');
    const baseUrl = 'https://api.github.com';

    const headers = {
      'Authorization': `Bearer ${credentials.apiKey}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const owner = this.getNodeParameter('owner', i) as string;
      const repository = this.getNodeParameter('repository', i) as string;
      const options = this.getNodeParameter('options', i, {}) as Record<string, any>;

      try {
        let responseData: any;

        if (resource === 'repository') {
          if (operation === 'get') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/repos/${owner}/${repository}`,
              headers,
              json: true,
            });
          } else if (operation === 'list') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/users/${owner}/repos`,
              headers,
              qs: {
                per_page: options.per_page || 30,
                page: options.page || 1,
              },
              json: true,
            });
          }
        } else if (resource === 'issue') {
          if (operation === 'list') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/repos/${owner}/${repository}/issues`,
              headers,
              qs: {
                state: options.state || 'open',
                per_page: options.per_page || 30,
                page: options.page || 1,
                labels: options.labels,
              },
              json: true,
            });
          } else if (operation === 'get') {
            const number = this.getNodeParameter('number', i) as number;
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/repos/${owner}/${repository}/issues/${number}`,
              headers,
              json: true,
            });
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;
            const body = this.getNodeParameter('body', i) as string;

            const issueBody: Record<string, any> = { title, body };
            if (options.labels) issueBody.labels = options.labels.split(',').map((l: string) => l.trim());
            if (options.assignees) issueBody.assignees = options.assignees.split(',').map((a: string) => a.trim());

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/repos/${owner}/${repository}/issues`,
              headers,
              body: issueBody,
              json: true,
            });
          } else if (operation === 'comment') {
            const number = this.getNodeParameter('number', i) as number;
            const body = this.getNodeParameter('body', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/repos/${owner}/${repository}/issues/${number}/comments`,
              headers,
              body: { body },
              json: true,
            });
          } else if (operation === 'close') {
            const number = this.getNodeParameter('number', i) as number;

            responseData = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/repos/${owner}/${repository}/issues/${number}`,
              headers,
              body: { state: 'closed' },
              json: true,
            });
          }
        } else if (resource === 'pullRequest') {
          if (operation === 'list') {
            responseData = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/repos/${owner}/${repository}/pulls`,
              headers,
              qs: {
                state: options.state || 'open',
                per_page: options.per_page || 30,
                page: options.page || 1,
              },
              json: true,
            });
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;
            const body = this.getNodeParameter('body', i) as string;
            const head = this.getNodeParameter('head', i) as string;
            const base = this.getNodeParameter('base', i) as string;

            responseData = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/repos/${owner}/${repository}/pulls`,
              headers,
              body: { title, body, head, base },
              json: true,
            });
          } else if (operation === 'merge') {
            const number = this.getNodeParameter('number', i) as number;

            responseData = await this.helpers.request({
              method: 'PUT',
              url: `${baseUrl}/repos/${owner}/${repository}/pulls/${number}/merge`,
              headers,
              json: true,
            });
          }
        }

        if (Array.isArray(responseData)) {
          returnData.push(...responseData.map(item => ({ json: item, pairedItem: { item: i } })));
        } else {
          returnData.push({ json: responseData, pairedItem: { item: i } });
        }
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  },
});

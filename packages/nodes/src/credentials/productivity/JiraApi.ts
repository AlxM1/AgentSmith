import { createCredentialType } from '@agentsmith/shared';

export const JiraApi = createCredentialType({
  name: 'jiraApi',
  displayName: 'Jira API',
  documentationUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
  properties: [
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Domain',
      name: 'domain',
      type: 'string',
      default: '',
      placeholder: 'yourcompany.atlassian.net',
      required: true,
    },
  ],
  authenticate: {
    type: 'basicAuth',
    basicAuth: {
      usernameField: 'email',
      passwordField: 'apiToken',
    },
  },
});

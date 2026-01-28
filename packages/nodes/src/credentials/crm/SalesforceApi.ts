import { createOAuth2Credential } from '@agentsmith/shared';

export const SalesforceApi = createOAuth2Credential({
  name: 'salesforceApi',
  displayName: 'Salesforce API',
  documentationUrl: 'https://developer.salesforce.com/docs/apis',
  authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  accessTokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  scope: ['api', 'refresh_token'],
  additionalProperties: [
    {
      displayName: 'Environment',
      name: 'environment',
      type: 'options',
      options: [
        { name: 'Production', value: 'production' },
        { name: 'Sandbox', value: 'sandbox' },
      ],
      default: 'production',
    },
  ],
});

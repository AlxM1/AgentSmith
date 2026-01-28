import { createOAuth2Credential } from '@agentsmith/shared';

export const ZohoApi = createOAuth2Credential({
  name: 'zohoApi',
  displayName: 'Zoho CRM API',
  documentationUrl: 'https://www.zoho.com/crm/developer/docs/api/v2/',
  authorizationUrl: 'https://accounts.zoho.com/oauth/v2/auth',
  accessTokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
  scope: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
  additionalProperties: [
    {
      displayName: 'Data Center',
      name: 'dataCenter',
      type: 'options',
      options: [
        { name: 'US (zoho.com)', value: 'com' },
        { name: 'EU (zoho.eu)', value: 'eu' },
        { name: 'India (zoho.in)', value: 'in' },
        { name: 'Australia (zoho.com.au)', value: 'com.au' },
        { name: 'Japan (zoho.jp)', value: 'jp' },
      ],
      default: 'com',
    },
  ],
});

import { createCredentialType } from '@agentsmith/shared';

export const TwilioApi = createCredentialType({
  name: 'twilioApi',
  displayName: 'Twilio API',
  documentationUrl: 'https://www.twilio.com/docs/usage/api',
  properties: [
    {
      displayName: 'Account SID',
      name: 'accountSid',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Auth Token',
      name: 'authToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'basicAuth',
    basicAuth: {
      usernameField: 'accountSid',
      passwordField: 'authToken',
    },
  },
});

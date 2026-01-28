import { createCredentialType } from '@agentsmith/shared';

export const SupabaseApi = createCredentialType({
  name: 'supabaseApi',
  displayName: 'Supabase API',
  documentationUrl: 'https://supabase.com/docs/guides/api',
  properties: [
    {
      displayName: 'Project URL',
      name: 'host',
      type: 'string',
      default: '',
      placeholder: 'https://xyzcompany.supabase.co',
      required: true,
    },
    {
      displayName: 'Service Role Key',
      name: 'serviceRoleKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ],
  authenticate: {
    type: 'header',
    header: {
      name: 'apikey',
      valueField: 'serviceRoleKey',
    },
  },
});

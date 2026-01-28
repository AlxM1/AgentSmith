import { createCredentialType } from '@agentsmith/shared';

export const FirebaseApi = createCredentialType({
  name: 'firebaseApi',
  displayName: 'Firebase API',
  documentationUrl: 'https://firebase.google.com/docs/reference/rest/database',
  properties: [
    {
      displayName: 'Project ID',
      name: 'projectId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Database URL',
      name: 'databaseUrl',
      type: 'string',
      default: '',
      placeholder: 'https://your-project.firebaseio.com',
      required: true,
    },
    {
      displayName: 'Service Account JSON',
      name: 'serviceAccountJson',
      type: 'json',
      default: '',
      required: true,
    },
  ],
});

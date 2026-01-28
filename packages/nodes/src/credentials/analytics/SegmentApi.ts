import { createApiKeyCredential } from '@agentsmith/shared';

export const SegmentApi = createApiKeyCredential({
  name: 'segmentApi',
  displayName: 'Segment API',
  documentationUrl: 'https://segment.com/docs/connections/sources/catalog/',
  headerName: 'Authorization',
  headerPrefix: 'Basic ',
});

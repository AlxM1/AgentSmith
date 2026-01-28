import { createApiKeyCredential } from '@agentsmith/shared';

export const StripeApi = createApiKeyCredential({
  name: 'stripeApi',
  displayName: 'Stripe API',
  documentationUrl: 'https://stripe.com/docs/api',
  headerName: 'Authorization',
  headerPrefix: 'Bearer ',
  testUrl: 'https://api.stripe.com/v1/balance',
});

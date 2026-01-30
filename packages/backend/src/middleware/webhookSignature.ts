/**
 * Webhook Signature Verification Middleware
 * Validates incoming webhooks from various providers (GitHub, Stripe, Slack, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSignatureConfig {
  provider: WebhookProvider;
  secret: string;
  headerName?: string;
  algorithm?: string;
  timestampTolerance?: number; // seconds
}

export type WebhookProvider =
  | 'github'
  | 'gitlab'
  | 'stripe'
  | 'slack'
  | 'shopify'
  | 'twilio'
  | 'sendgrid'
  | 'mailchimp'
  | 'hubspot'
  | 'intercom'
  | 'custom';

interface SignatureVerifier {
  verify: (req: Request, secret: string, config?: WebhookSignatureConfig) => boolean;
  headerName: string;
}

// Provider-specific verifiers
const verifiers: Record<WebhookProvider, SignatureVerifier> = {
  github: {
    headerName: 'x-hub-signature-256',
    verify: (req, secret) => {
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  gitlab: {
    headerName: 'x-gitlab-token',
    verify: (req, secret) => {
      const token = req.headers['x-gitlab-token'] as string;
      return token === secret;
    },
  },

  stripe: {
    headerName: 'stripe-signature',
    verify: (req, secret, config) => {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);

      // Parse Stripe signature header
      const parts = signature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const timestamp = parts['t'];
      const expectedSignature = parts['v1'];

      if (!timestamp || !expectedSignature) return false;

      // Check timestamp tolerance (default 5 minutes)
      const tolerance = config?.timestampTolerance || 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > tolerance) {
        return false;
      }

      // Compute expected signature
      const payload = `${timestamp}.${body}`;
      const computed = createHmac('sha256', secret).update(payload).digest('hex');

      return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(computed));
    },
  },

  slack: {
    headerName: 'x-slack-signature',
    verify: (req, secret, config) => {
      const signature = req.headers['x-slack-signature'] as string;
      const timestamp = req.headers['x-slack-request-timestamp'] as string;

      if (!signature || !timestamp) return false;

      // Check timestamp (within 5 minutes)
      const tolerance = config?.timestampTolerance || 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > tolerance) {
        return false;
      }

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const baseString = `v0:${timestamp}:${body}`;
      const expected = 'v0=' + createHmac('sha256', secret).update(baseString).digest('hex');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  shopify: {
    headerName: 'x-shopify-hmac-sha256',
    verify: (req, secret) => {
      const signature = req.headers['x-shopify-hmac-sha256'] as string;
      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expected = createHmac('sha256', secret).update(body).digest('base64');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  twilio: {
    headerName: 'x-twilio-signature',
    verify: (req, secret) => {
      const signature = req.headers['x-twilio-signature'] as string;
      if (!signature) return false;

      // Twilio uses URL + POST params for signature
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const params = req.body;

      // Sort parameters and create string
      const paramString = Object.keys(params)
        .sort()
        .map(key => `${key}${params[key]}`)
        .join('');

      const data = url + paramString;
      const expected = createHmac('sha1', secret).update(data).digest('base64');

      return signature === expected;
    },
  },

  sendgrid: {
    headerName: 'x-twilio-email-event-webhook-signature',
    verify: (req, secret, config) => {
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

      if (!signature || !timestamp) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const payload = timestamp + body;

      // SendGrid uses ECDSA
      const crypto = require('crypto');
      const verify = crypto.createVerify('sha256');
      verify.update(payload);
      verify.end();

      try {
        return verify.verify(secret, signature, 'base64');
      } catch {
        return false;
      }
    },
  },

  mailchimp: {
    headerName: 'x-mailchimp-signature',
    verify: (req, secret) => {
      const signature = req.headers['x-mailchimp-signature'] as string;
      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expected = createHmac('sha256', secret).update(body).digest('hex');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  hubspot: {
    headerName: 'x-hubspot-signature-v3',
    verify: (req, secret, config) => {
      const signature = req.headers['x-hubspot-signature-v3'] as string;
      const timestamp = req.headers['x-hubspot-request-timestamp'] as string;

      if (!signature || !timestamp) return false;

      // Check timestamp tolerance
      const tolerance = config?.timestampTolerance || 300;
      const now = Date.now();
      if (Math.abs(now - parseInt(timestamp)) > tolerance * 1000) {
        return false;
      }

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const method = req.method;

      const payload = `${method}${url}${body}${timestamp}`;
      const expected = createHmac('sha256', secret).update(payload).digest('base64');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  intercom: {
    headerName: 'x-hub-signature',
    verify: (req, secret) => {
      const signature = req.headers['x-hub-signature'] as string;
      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expected = 'sha1=' + createHmac('sha1', secret).update(body).digest('hex');

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  },

  custom: {
    headerName: 'x-webhook-signature',
    verify: (req, secret, config) => {
      const headerName = config?.headerName || 'x-webhook-signature';
      const algorithm = config?.algorithm || 'sha256';
      const signature = req.headers[headerName.toLowerCase()] as string;

      if (!signature) return false;

      const body = (req as any).rawBody || JSON.stringify(req.body);
      const expected = createHmac(algorithm, secret).update(body).digest('hex');

      // Support both with and without algorithm prefix
      const sigWithoutPrefix = signature.replace(/^sha\d+=/, '');

      return timingSafeEqual(Buffer.from(sigWithoutPrefix), Buffer.from(expected));
    },
  },
};

/**
 * Create webhook signature verification middleware
 */
export function createWebhookSignatureMiddleware(config: WebhookSignatureConfig) {
  const verifier = verifiers[config.provider];

  if (!verifier) {
    throw new Error(`Unknown webhook provider: ${config.provider}`);
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isValid = verifier.verify(req, config.secret, config);

      if (!isValid) {
        console.warn('Webhook signature verification failed', {
          provider: config.provider,
          ip: req.ip,
          path: req.path,
        });

        return res.status(401).json({
          error: 'Invalid webhook signature',
          provider: config.provider,
        });
      }

      // Add verification info to request
      (req as any).webhookVerified = true;
      (req as any).webhookProvider = config.provider;

      next();
    } catch (error: any) {
      console.error('Webhook signature verification error:', error);
      return res.status(500).json({ error: 'Signature verification error' });
    }
  };
}

/**
 * Middleware to capture raw body for signature verification
 */
export function captureRawBody(req: Request, res: Response, next: NextFunction) {
  let data = '';

  req.on('data', chunk => {
    data += chunk;
  });

  req.on('end', () => {
    (req as any).rawBody = data;
    next();
  });
}

/**
 * Express middleware that preserves raw body
 */
export function rawBodyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('application/json')) {
      let data = '';
      req.setEncoding('utf8');

      req.on('data', chunk => {
        data += chunk;
      });

      req.on('end', () => {
        (req as any).rawBody = data;
        try {
          req.body = JSON.parse(data);
        } catch {
          req.body = {};
        }
        next();
      });
    } else {
      next();
    }
  };
}

/**
 * Verify a webhook signature programmatically
 */
export function verifyWebhookSignature(
  provider: WebhookProvider,
  payload: string | Buffer,
  signature: string,
  secret: string,
  options?: Partial<WebhookSignatureConfig>
): boolean {
  const verifier = verifiers[provider];
  if (!verifier) return false;

  // Create a mock request object
  const mockReq = {
    headers: { [verifier.headerName]: signature },
    body: typeof payload === 'string' ? JSON.parse(payload) : payload,
    rawBody: typeof payload === 'string' ? payload : payload.toString(),
  } as unknown as Request;

  return verifier.verify(mockReq, secret, { provider, secret, ...options });
}

/**
 * Generate a webhook signature for testing
 */
export function generateWebhookSignature(
  provider: WebhookProvider,
  payload: string | object,
  secret: string,
  options?: { timestamp?: number; algorithm?: string }
): { signature: string; headers: Record<string, string> } {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const timestamp = options?.timestamp || Math.floor(Date.now() / 1000);

  switch (provider) {
    case 'github':
      const ghSig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
      return { signature: ghSig, headers: { 'x-hub-signature-256': ghSig } };

    case 'stripe':
      const stripeSig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
      const stripeHeader = `t=${timestamp},v1=${stripeSig}`;
      return { signature: stripeHeader, headers: { 'stripe-signature': stripeHeader } };

    case 'slack':
      const slackSig = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex');
      return {
        signature: slackSig,
        headers: {
          'x-slack-signature': slackSig,
          'x-slack-request-timestamp': String(timestamp),
        },
      };

    case 'shopify':
      const shopifySig = createHmac('sha256', secret).update(body).digest('base64');
      return { signature: shopifySig, headers: { 'x-shopify-hmac-sha256': shopifySig } };

    default:
      const customSig = createHmac(options?.algorithm || 'sha256', secret).update(body).digest('hex');
      return { signature: customSig, headers: { 'x-webhook-signature': customSig } };
  }
}

export default createWebhookSignatureMiddleware;

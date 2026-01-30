/**
 * Webhook Authentication Middleware
 *
 * Enterprise feature for securing webhooks:
 * - HMAC signature verification
 * - Basic authentication
 * - API key authentication
 * - JWT bearer tokens
 * - Custom header authentication
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type WebhookAuthType = 'none' | 'hmac' | 'basic' | 'apikey' | 'bearer' | 'header';

export interface WebhookAuthConfig {
  type: WebhookAuthType;
  // HMAC configuration
  hmac?: {
    secret: string;
    algorithm?: 'sha256' | 'sha512' | 'sha1';
    header?: string;
    prefix?: string;
    encoding?: 'hex' | 'base64';
  };
  // Basic auth configuration
  basic?: {
    username: string;
    password: string;
  };
  // API key configuration
  apiKey?: {
    key: string;
    header?: string;
    query?: string;
  };
  // Bearer token configuration
  bearer?: {
    token: string;
  };
  // Custom header configuration
  header?: {
    name: string;
    value: string;
  };
}

export interface AuthenticatedWebhookRequest extends Request {
  webhookAuth?: {
    type: WebhookAuthType;
    verified: boolean;
  };
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Verify HMAC signature
 */
function verifyHmacSignature(
  payload: Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256',
  prefix: string = '',
  encoding: 'hex' | 'base64' = 'hex'
): boolean {
  try {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    const expectedSignature = `${prefix}${hmac.digest(encoding)}`;

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    logger.error('HMAC verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Verify Basic authentication
 */
function verifyBasicAuth(authHeader: string, username: string, password: string): boolean {
  try {
    if (!authHeader.startsWith('Basic ')) {
      return false;
    }

    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [providedUsername, providedPassword] = credentials.split(':');

    // Use timing-safe comparison
    const usernameMatch = crypto.timingSafeEqual(
      Buffer.from(providedUsername),
      Buffer.from(username)
    );
    const passwordMatch = crypto.timingSafeEqual(
      Buffer.from(providedPassword),
      Buffer.from(password)
    );

    return usernameMatch && passwordMatch;
  } catch (error) {
    return false;
  }
}

/**
 * Verify API key
 */
function verifyApiKey(providedKey: string, expectedKey: string): boolean {
  try {
    const providedBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(expectedKey);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * Verify Bearer token
 */
function verifyBearerToken(authHeader: string, expectedToken: string): boolean {
  try {
    if (!authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch (error) {
    return false;
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create webhook authentication middleware
 */
export function createWebhookAuthMiddleware(config: WebhookAuthConfig) {
  return async (req: AuthenticatedWebhookRequest, res: Response, next: NextFunction) => {
    // No authentication required
    if (config.type === 'none') {
      req.webhookAuth = { type: 'none', verified: true };
      return next();
    }

    try {
      let verified = false;

      switch (config.type) {
        case 'hmac': {
          if (!config.hmac) {
            return res.status(500).json({ error: 'HMAC configuration missing' });
          }

          const signatureHeader = config.hmac.header || 'x-webhook-signature';
          const signature = req.headers[signatureHeader.toLowerCase()] as string;

          if (!signature) {
            logger.warn('Webhook HMAC signature missing', {
              path: req.path,
              expectedHeader: signatureHeader,
            });
            return res.status(401).json({ error: 'Signature header missing' });
          }

          // Get raw body for signature verification
          const rawBody = (req as any).rawBody as Buffer;
          if (!rawBody) {
            logger.error('Raw body not available for HMAC verification');
            return res.status(500).json({ error: 'Cannot verify signature' });
          }

          verified = verifyHmacSignature(
            rawBody,
            signature,
            config.hmac.secret,
            config.hmac.algorithm,
            config.hmac.prefix,
            config.hmac.encoding
          );

          if (!verified) {
            logger.warn('Webhook HMAC signature invalid', { path: req.path });
            return res.status(401).json({ error: 'Invalid signature' });
          }
          break;
        }

        case 'basic': {
          if (!config.basic) {
            return res.status(500).json({ error: 'Basic auth configuration missing' });
          }

          const authHeader = req.headers.authorization;
          if (!authHeader) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Webhook"');
            return res.status(401).json({ error: 'Authentication required' });
          }

          verified = verifyBasicAuth(authHeader, config.basic.username, config.basic.password);

          if (!verified) {
            logger.warn('Webhook Basic auth failed', { path: req.path });
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          break;
        }

        case 'apikey': {
          if (!config.apiKey) {
            return res.status(500).json({ error: 'API key configuration missing' });
          }

          let providedKey: string | undefined;

          // Check header
          if (config.apiKey.header) {
            providedKey = req.headers[config.apiKey.header.toLowerCase()] as string;
          }

          // Check query parameter
          if (!providedKey && config.apiKey.query) {
            providedKey = req.query[config.apiKey.query] as string;
          }

          // Default to X-API-Key header
          if (!providedKey) {
            providedKey = req.headers['x-api-key'] as string;
          }

          if (!providedKey) {
            return res.status(401).json({ error: 'API key missing' });
          }

          verified = verifyApiKey(providedKey, config.apiKey.key);

          if (!verified) {
            logger.warn('Webhook API key invalid', { path: req.path });
            return res.status(401).json({ error: 'Invalid API key' });
          }
          break;
        }

        case 'bearer': {
          if (!config.bearer) {
            return res.status(500).json({ error: 'Bearer token configuration missing' });
          }

          const authHeader = req.headers.authorization;
          if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
          }

          verified = verifyBearerToken(authHeader, config.bearer.token);

          if (!verified) {
            logger.warn('Webhook Bearer token invalid', { path: req.path });
            return res.status(401).json({ error: 'Invalid token' });
          }
          break;
        }

        case 'header': {
          if (!config.header) {
            return res.status(500).json({ error: 'Header configuration missing' });
          }

          const headerValue = req.headers[config.header.name.toLowerCase()] as string;

          if (!headerValue) {
            return res.status(401).json({ error: `Header ${config.header.name} missing` });
          }

          try {
            const valueBuffer = Buffer.from(headerValue);
            const expectedBuffer = Buffer.from(config.header.value);

            if (valueBuffer.length === expectedBuffer.length) {
              verified = crypto.timingSafeEqual(valueBuffer, expectedBuffer);
            }
          } catch {
            verified = false;
          }

          if (!verified) {
            logger.warn('Webhook header auth failed', { path: req.path });
            return res.status(401).json({ error: 'Invalid header value' });
          }
          break;
        }

        default:
          return res.status(500).json({ error: 'Unknown authentication type' });
      }

      req.webhookAuth = { type: config.type, verified };
      next();
    } catch (error) {
      logger.error('Webhook authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

/**
 * Raw body middleware for HMAC verification
 * Must be used before JSON body parser
 */
export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.headers['content-type']?.includes('application/json')) {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });

    req.on('error', (err) => {
      next(err);
    });
  } else {
    next();
  }
}

/**
 * Generate HMAC signature for outgoing webhooks
 */
export function generateHmacSignature(
  payload: string | Buffer,
  secret: string,
  algorithm: string = 'sha256',
  prefix: string = '',
  encoding: 'hex' | 'base64' = 'hex'
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payload);
  return `${prefix}${hmac.digest(encoding)}`;
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

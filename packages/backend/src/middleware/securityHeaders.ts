// Security Headers Middleware
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Extend Express types for nonce
declare global {
  namespace Express {
    interface Response {
      locals: {
        nonce?: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * Generate a cryptographic nonce for CSP
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Content Security Policy configuration
 * Production-ready with nonce support, no unsafe-inline/eval
 */
const getCSPDirectives = (nonce: string, isProduction: boolean) => {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Use nonce for scripts - no unsafe-inline or unsafe-eval
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    // Style nonce for production, unsafe-inline only in dev
    'style-src': isProduction
      ? ["'self'", `'nonce-${nonce}'`, 'https://fonts.googleapis.com']
      : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    // Restrict connect-src to known origins
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],  // Stronger than SAMEORIGIN
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': [],
  };

  // Add WebSocket URLs for connect-src in production
  if (isProduction) {
    const wsOrigin = process.env.WS_ORIGIN || 'wss://agentsmith.example.com';
    const apiOrigin = process.env.API_ORIGIN || 'https://agentsmith.example.com';
    directives['connect-src'].push(wsOrigin, apiOrigin);
  } else {
    // Development allows localhost WebSocket
    directives['connect-src'].push('ws://localhost:*', 'wss://localhost:*', 'http://localhost:*');
  }

  // Add report-uri in production for CSP violation reporting
  if (isProduction && process.env.CSP_REPORT_URI) {
    directives['report-uri'] = [process.env.CSP_REPORT_URI];
  }

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
};

/**
 * Report-Only CSP for testing new policies
 */
const getCSPReportOnly = (nonce: string) => {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`],
    'style-src': ["'self'", `'nonce-${nonce}'`],
    'report-uri': [process.env.CSP_REPORT_URI || '/api/csp-report'],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};

/**
 * Permissions Policy (formerly Feature-Policy)
 * Restrictive by default - deny all potentially dangerous features
 */
const getPermissionsPolicy = () => {
  const policies: Record<string, string[]> = {
    'accelerometer': [],
    'ambient-light-sensor': [],
    'autoplay': [],
    'battery': [],
    'camera': [],
    'cross-origin-isolated': ['self'],
    'display-capture': [],
    'document-domain': [],
    'encrypted-media': [],
    'execution-while-not-rendered': [],
    'execution-while-out-of-viewport': [],
    'fullscreen': ['self'],
    'geolocation': [],
    'gyroscope': [],
    'keyboard-map': [],
    'magnetometer': [],
    'microphone': [],
    'midi': [],
    'navigation-override': [],
    'payment': [],
    'picture-in-picture': [],
    'publickey-credentials-get': [],
    'screen-wake-lock': [],
    'sync-xhr': [],
    'usb': [],
    'web-share': [],
    'xr-spatial-tracking': [],
    'clipboard-read': ['self'],
    'clipboard-write': ['self'],
  };

  return Object.entries(policies)
    .map(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowlist.join(' ')})`;
    })
    .join(', ');
};

/**
 * Security headers middleware - production hardened
 */
export const securityHeaders = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return (req: Request, res: Response, next: NextFunction) => {
    // Generate nonce for this request
    const nonce = generateNonce();
    res.locals.nonce = nonce;

    // Content Security Policy
    res.setHeader('Content-Security-Policy', getCSPDirectives(nonce, isProduction));

    // Optionally use Report-Only for testing stricter policies
    if (process.env.CSP_REPORT_ONLY === 'true') {
      res.setHeader('Content-Security-Policy-Report-Only', getCSPReportOnly(nonce));
    }

    // XSS Protection (legacy but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Type Options - prevents MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Frame Options - use DENY for APIs, SAMEORIGIN for pages
    res.setHeader('X-Frame-Options', req.path.startsWith('/api/') ? 'DENY' : 'SAMEORIGIN');

    // Referrer Policy - strict for security, but allow same-origin for functionality
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', getPermissionsPolicy());

    // HSTS - HTTP Strict Transport Security
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload' // 2 years
      );
    }

    // Cross-Origin policies for enhanced isolation
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Cache Control for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // Remove potentially sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Add security-related response headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  };
};

/**
 * CORS preflight handling with security headers
 */
export const corsSecurityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    next();
  };
};

/**
 * Request ID middleware for tracing
 */
export const requestId = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.headers['x-request-id'] as string ||
      `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);

    // Also set correlation ID if provided
    const correlationId = req.headers['x-correlation-id'] as string;
    if (correlationId) {
      res.setHeader('X-Correlation-Id', correlationId);
    }

    next();
  };
};

/**
 * CSP violation report handler
 */
export const cspReportHandler = () => {
  return (req: Request, res: Response) => {
    if (req.body && req.body['csp-report']) {
      console.warn('CSP Violation:', JSON.stringify(req.body['csp-report'], null, 2));
      // In production, send to logging service
    }
    res.status(204).end();
  };
};

/**
 * Get nonce for templates
 */
export const getNonce = (res: Response): string => {
  return res.locals.nonce || generateNonce();
};

export default securityHeaders;

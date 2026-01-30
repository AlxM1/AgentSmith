// Security Headers Middleware
import { Request, Response, NextFunction } from 'express';

/**
 * Content Security Policy configuration
 */
const getCSPDirectives = () => {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for some frontend frameworks
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    'connect-src': ["'self'", 'wss:', 'https:'],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  // Add nonce support for scripts (optional, requires nonce generation per request)
  // directives['script-src'].push((req, res) => `'nonce-${res.locals.nonce}'`);

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};

/**
 * Permissions Policy (formerly Feature-Policy)
 */
const getPermissionsPolicy = () => {
  const policies: Record<string, string[]> = {
    'accelerometer': [],
    'camera': [],
    'geolocation': [],
    'gyroscope': [],
    'magnetometer': [],
    'microphone': [],
    'payment': [],
    'usb': [],
    'fullscreen': ['self'],
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
 * Security headers middleware
 */
export const securityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', getCSPDirectives());

    // XSS Protection (legacy but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Type Options - prevents MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Frame Options - prevents clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', getPermissionsPolicy());

    // HSTS - HTTP Strict Transport Security
    // Only enable in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Cache Control for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Remove potentially sensitive headers
    res.removeHeader('X-Powered-By');

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
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);

    next();
  };
};

export default securityHeaders;

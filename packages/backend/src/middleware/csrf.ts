/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * Implements double-submit cookie pattern with signed tokens
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './errorHandler.js';

// Configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '__Host-csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = 3600000; // 1 hour in milliseconds

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      csrfToken?: () => string;
    }
  }
}

interface TokenPayload {
  value: string;
  timestamp: number;
  signature: string;
}

/**
 * Generate a signed CSRF token
 */
function generateToken(): TokenPayload {
  const value = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const timestamp = Date.now();
  const signature = signToken(value, timestamp);

  return { value, timestamp, signature };
}

/**
 * Sign a token with HMAC
 */
function signToken(value: string, timestamp: number): string {
  const data = `${value}:${timestamp}`;
  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Verify token signature and expiry
 */
function verifyToken(token: TokenPayload): boolean {
  // Check expiry
  if (Date.now() - token.timestamp > TOKEN_EXPIRY) {
    return false;
  }

  // Verify signature
  const expectedSignature = signToken(token.value, token.timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(token.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Encode token for cookie/header
 */
function encodeToken(token: TokenPayload): string {
  return Buffer.from(JSON.stringify(token)).toString('base64url');
}

/**
 * Decode token from cookie/header
 */
function decodeToken(encoded: string): TokenPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const token = JSON.parse(json);

    if (!token.value || !token.timestamp || !token.signature) {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Safe methods that don't require CSRF protection
 */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

/**
 * Paths that are exempt from CSRF protection
 * (webhooks, API key authenticated endpoints, etc.)
 */
const EXEMPT_PATHS = [
  /^\/api\/webhooks\//,
  /^\/api\/v\d+\/webhooks\//,
  /^\/health/,
  /^\/metrics/,
  /^\/api\/csp-report/,
];

/**
 * Check if request is exempt from CSRF
 */
function isExempt(req: Request): boolean {
  // Safe methods don't need CSRF
  if (SAFE_METHODS.includes(req.method)) {
    return true;
  }

  // API key authenticated requests are exempt
  if (req.headers['x-api-key']) {
    return true;
  }

  // Check exempt paths
  for (const pattern of EXEMPT_PATHS) {
    if (pattern.test(req.path)) {
      return true;
    }
  }

  return false;
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add token generator to request
    req.csrfToken = () => {
      const token = generateToken();
      const encoded = encodeToken(token);

      // Set cookie with security flags
      res.cookie(CSRF_COOKIE_NAME, encoded, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY,
      });

      return encoded;
    };

    // Skip validation for exempt requests
    if (isExempt(req)) {
      return next();
    }

    // Get token from header
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;
    if (!headerToken) {
      return next(new ForbiddenError('CSRF token missing'));
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!cookieToken) {
      return next(new ForbiddenError('CSRF cookie missing'));
    }

    // Decode tokens
    const headerPayload = decodeToken(headerToken);
    const cookiePayload = decodeToken(cookieToken);

    if (!headerPayload || !cookiePayload) {
      return next(new ForbiddenError('Invalid CSRF token format'));
    }

    // Verify header token signature
    if (!verifyToken(headerPayload)) {
      return next(new ForbiddenError('Invalid or expired CSRF token'));
    }

    // Double-submit: header and cookie must match
    if (headerPayload.value !== cookiePayload.value) {
      return next(new ForbiddenError('CSRF token mismatch'));
    }

    // Verify timestamps are close (within 5 seconds to account for latency)
    if (Math.abs(headerPayload.timestamp - cookiePayload.timestamp) > 5000) {
      return next(new ForbiddenError('CSRF token timestamp mismatch'));
    }

    next();
  };
}

/**
 * Generate CSRF token endpoint
 * Call this to get a new CSRF token for forms/AJAX
 */
export function csrfTokenHandler() {
  return (req: Request, res: Response) => {
    const token = req.csrfToken?.();

    if (!token) {
      return res.status(500).json({ error: 'CSRF middleware not initialized' });
    }

    res.json({
      csrfToken: token,
      expiresIn: TOKEN_EXPIRY,
      headerName: CSRF_HEADER_NAME,
    });
  };
}

/**
 * Simpler token-based CSRF for SPAs
 * Uses a stateless token stored in localStorage
 */
export function spaCSRFProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for exempt requests
    if (isExempt(req)) {
      return next();
    }

    // For SPAs, we use Origin/Referer header checking
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Must have either Origin or Referer
    if (!origin && !referer) {
      // Allow same-site requests without Origin (some browsers don't send it)
      const host = req.headers.host;
      if (!host) {
        return next(new ForbiddenError('CSRF validation failed: missing origin'));
      }
      return next();
    }

    // Validate origin matches our allowed origins
    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());
    const requestOrigin = origin || new URL(referer!).origin;

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(requestOrigin)) {
      // Also check if it matches the host
      const host = req.headers.host;
      const protocol = req.secure ? 'https' : 'http';
      const hostOrigin = `${protocol}://${host}`;

      if (requestOrigin !== hostOrigin && !requestOrigin.includes('localhost')) {
        return next(new ForbiddenError('CSRF validation failed: origin mismatch'));
      }
    }

    next();
  };
}

/**
 * Get CSRF configuration for client
 */
export function getCSRFConfig(): {
  cookieName: string;
  headerName: string;
  tokenExpiry: number;
} {
  return {
    cookieName: CSRF_COOKIE_NAME,
    headerName: CSRF_HEADER_NAME,
    tokenExpiry: TOKEN_EXPIRY,
  };
}

export default csrfProtection;

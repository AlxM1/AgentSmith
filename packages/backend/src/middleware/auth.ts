// @ts-nocheck
// Authentication Middleware

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';
import type { UserRole, IUserPublicData } from '@agentsmith/shared';

// Import ApiKey type
import type { ApiKey } from '../services/ApiKeyService.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IUserPublicData;
      token?: string;
      apiKey?: ApiKey;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Authenticate user via JWT token
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authorization header provided');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid authorization format. Use: Bearer <token>');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token has expired'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    req.token = token;

    next();
  } catch {
    // Ignore token errors for optional auth
    next();
  }
}

/**
 * Require specific roles
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Generate JWT tokens
 */
export function generateTokens(user: IUserPublicData): {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  // Calculate expiration time
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresAt = decoded.exp * 1000;

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as {
    userId: string;
    type: string;
  };

  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  return { userId: decoded.userId };
}

/**
 * API Key authentication middleware
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;

    if (!apiKeyHeader) {
      throw new UnauthorizedError('No API key provided');
    }

    // Validate API key
    const { apiKeyService } = await import('../services/ApiKeyService.js');
    const result = await apiKeyService.validateKey(apiKeyHeader);

    if (!result.valid || !result.apiKey) {
      throw new UnauthorizedError(result.error || 'Invalid API key');
    }

    // Check rate limits
    const clientIp = req.ip || req.socket.remoteAddress;
    const rateLimitResult = apiKeyService.checkRateLimit(result.apiKey, clientIp);

    if (!rateLimitResult.allowed) {
      res.setHeader('Retry-After', String(rateLimitResult.retryAfter || 60));
      res.setHeader('X-RateLimit-Limit', String(result.apiKey.rateLimit?.requestsPerMinute || 'unlimited'));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Attach API key info to request
    req.apiKey = result.apiKey;
    req.user = {
      id: result.userId!,
      email: `apikey:${result.apiKey.keyPrefix}`,
      role: 'user', // API keys use scope-based permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require specific API key scope
 */
export function requireApiKeyScope(scope: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(new UnauthorizedError('API key authentication required'));
    }

    const { apiKeyService } = await import('../services/ApiKeyService.js');

    if (!apiKeyService.hasScope(req.apiKey, scope as any)) {
      return next(new ForbiddenError(`API key lacks required scope: ${scope}`));
    }

    next();
  };
}

/**
 * Check API key permission for resource/action
 */
export function requireApiKeyPermission(resource: string, action: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(new UnauthorizedError('API key authentication required'));
    }

    const { apiKeyService } = await import('../services/ApiKeyService.js');

    if (!apiKeyService.hasPermission(req.apiKey, resource, action)) {
      return next(new ForbiddenError(`API key lacks permission: ${resource}:${action}`));
    }

    next();
  };
}

/**
 * Combined auth - accepts either JWT or API key
 */
export async function authenticateAny(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (apiKeyHeader) {
    return authenticateApiKey(req, res, next);
  }

  if (authHeader) {
    return authenticate(req, res, next);
  }

  next(new UnauthorizedError('Authentication required. Provide Bearer token or X-API-Key header.'));
}

// @ts-nocheck
/**
 * SSO Routes
 * OAuth2/OIDC authentication endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ssoService, SSOUser } from '../services/SSOService.js';
import { db } from '../db/index.js';
import { users } from '@agentsmith/shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/v1/auth/sso/providers
 * Get list of enabled SSO providers
 */
router.get('/providers', (req: Request, res: Response) => {
  const providers = ssoService.getEnabledProviders();

  res.json({
    success: true,
    data: providers,
  });
});

/**
 * GET /api/v1/auth/sso/:provider
 * Initiate SSO login
 */
router.get('/:provider', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const { redirect } = req.query;

    // Build redirect URI
    const baseUrl = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/v1/auth/sso/${provider}/callback`;

    // Generate auth URL
    const authUrl = ssoService.generateAuthUrl(provider, redirectUri);

    // Store the intended destination in a cookie for after auth
    if (redirect) {
      res.cookie('sso_redirect', redirect, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });
    }

    // Redirect to provider
    res.redirect(authUrl);
  } catch (error) {
    logger.error('SSO initiation failed', {
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

/**
 * GET /api/v1/auth/sso/:provider/callback
 * Handle OAuth callback
 */
router.get('/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const { code, state, error, error_description } = req.query;

    // Check for OAuth errors
    if (error) {
      logger.warn('SSO callback received error', {
        provider,
        error,
        description: error_description,
      });
      return res.redirect(`/login?error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || !state) {
      return res.redirect('/login?error=missing_parameters');
    }

    // Build redirect URI (must match the one used in auth request)
    const baseUrl = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/v1/auth/sso/${provider}/callback`;

    // Handle callback
    const { user: ssoUser, tokens } = await ssoService.handleCallback(
      String(code),
      String(state),
      redirectUri
    );

    // Find or create user in database
    const dbUser = await findOrCreateUser(ssoUser);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        provider: ssoUser.provider,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn || '24h' }
    );

    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, dbUser.id));

    // Get stored redirect destination
    const intendedRedirect = req.cookies.sso_redirect || '/';
    res.clearCookie('sso_redirect');

    // Set auth cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Redirect to frontend with token
    // Frontend should extract the token from the URL and store it
    const frontendUrl = config.frontendUrl || baseUrl;
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&redirect=${encodeURIComponent(intendedRedirect)}`);
  } catch (error) {
    logger.error('SSO callback failed', {
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.redirect(`/login?error=${encodeURIComponent('Authentication failed')}`);
  }
});

/**
 * POST /api/v1/auth/sso/link/:provider
 * Link an SSO provider to existing account
 * Requires authentication
 */
router.post('/link/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Build redirect URI
    const baseUrl = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/v1/auth/sso/${provider}/link-callback`;

    // Generate auth URL
    const authUrl = ssoService.generateAuthUrl(provider, redirectUri);

    // Store user ID for linking
    res.cookie('sso_link_user', userId, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/sso/:provider/link-callback
 * Handle account linking callback
 */
router.get('/:provider/link-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;
    const userId = req.cookies.sso_link_user;

    res.clearCookie('sso_link_user');

    if (error || !code || !state || !userId) {
      return res.redirect('/settings?error=link_failed');
    }

    // Build redirect URI
    const baseUrl = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/api/v1/auth/sso/${provider}/link-callback`;

    // Handle callback
    const { user: ssoUser } = await ssoService.handleCallback(
      String(code),
      String(state),
      redirectUri
    );

    // Check if SSO account is already linked to another user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.ssoId, ssoUser.id),
    });

    if (existingUser && existingUser.id !== userId) {
      return res.redirect('/settings?error=sso_already_linked');
    }

    // Link SSO to user account
    await db.update(users)
      .set({
        ssoId: ssoUser.id,
        ssoProvider: ssoUser.provider,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('SSO account linked', {
      userId,
      provider: ssoUser.provider,
      ssoId: ssoUser.id,
    });

    res.redirect('/settings?success=sso_linked');
  } catch (error) {
    logger.error('SSO linking failed', {
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.redirect('/settings?error=link_failed');
  }
});

/**
 * POST /api/v1/auth/sso/unlink/:provider
 * Unlink SSO provider from account
 * Requires authentication
 */
router.post('/unlink/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Ensure user has a password if unlinking (can't lock themselves out)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'Cannot unlink SSO without a password set',
      });
    }

    // Unlink SSO
    await db.update(users)
      .set({
        ssoId: null,
        ssoProvider: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('SSO account unlinked', {
      userId,
      provider,
    });

    res.json({
      success: true,
      data: { message: 'SSO provider unlinked successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find existing user or create new one from SSO data
 */
async function findOrCreateUser(ssoUser: SSOUser): Promise<{
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}> {
  // First, try to find by SSO ID
  let user = await db.query.users.findFirst({
    where: eq(users.ssoId, ssoUser.id),
  });

  if (user) {
    // Update user info from SSO
    await db.update(users)
      .set({
        firstName: ssoUser.firstName || user.firstName,
        lastName: ssoUser.lastName || user.lastName,
        avatar: ssoUser.avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    };
  }

  // Try to find by email
  user = await db.query.users.findFirst({
    where: eq(users.email, ssoUser.email),
  });

  if (user) {
    // Link SSO to existing account
    await db.update(users)
      .set({
        ssoId: ssoUser.id,
        ssoProvider: ssoUser.provider,
        firstName: ssoUser.firstName || user.firstName,
        lastName: ssoUser.lastName || user.lastName,
        avatar: ssoUser.avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    };
  }

  // Create new user
  const [newUser] = await db.insert(users)
    .values({
      email: ssoUser.email,
      firstName: ssoUser.firstName || (ssoUser.displayName?.split(' ')[0]),
      lastName: ssoUser.lastName || (ssoUser.displayName?.split(' ').slice(1).join(' ')),
      avatar: ssoUser.avatar,
      role: 'user', // Default role for SSO users
      isActive: true,
      ssoId: ssoUser.id,
      ssoProvider: ssoUser.provider,
    })
    .returning();

  logger.info('Created new user from SSO', {
    userId: newUser.id,
    email: newUser.email,
    provider: ssoUser.provider,
  });

  return {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    firstName: newUser.firstName || undefined,
    lastName: newUser.lastName || undefined,
  };
}

export { router as ssoRouter };

// Authentication Routes

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, generateTokens, verifyRefreshToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { loginSchema, userCreateSchema, passwordChangeSchema } from '@agentsmith/shared';
import { generateUserId, defaultUserSettings } from '@agentsmith/shared';
import type { IUserPublicData } from '@agentsmith/shared';

const router = Router();

// Rate limiter for login attempts (in-memory, per IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT = 5; // max attempts
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minute lockout after exceeded

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= LOGIN_RATE_LIMIT) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  
  entry.count++;
  return { allowed: true };
}

function recordFailedLogin(ip: string) {
  const entry = loginAttempts.get(ip);
  if (entry && entry.count >= LOGIN_RATE_LIMIT) {
    // Extend lockout on continued attempts
    entry.resetAt = Date.now() + LOGIN_LOCKOUT_MS;
  }
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

// Login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    // Rate limit check
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      logger.warn(`Login rate limit exceeded for IP: ${clientIp}`);
      res.set('Retry-After', String(rateCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: `Too many login attempts. Try again in ${rateCheck.retryAfterSec} seconds.` }
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      recordFailedLogin(clientIp);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Successful login — clear rate limit
    clearLoginAttempts(clientIp);

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Generate tokens
    const userData: IUserPublicData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      role: user.role,
    };

    const tokens = generateTokens(userData);

    res.json({
      success: true,
      user: userData,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Register (signup)
router.post('/register', validateBody(userCreateSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if email exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = generateUserId();
    const newUser = {
      id: userId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'user' as const,
      isActive: true,
      isPending: false,
      settings: defaultUserSettings,
    };

    await db.insert(users).values(newUser);

    // Generate tokens
    const userData: IUserPublicData = {
      id: userId,
      email,
      firstName,
      lastName,
      role: 'user',
    };

    const tokens = generateTokens(userData);

    res.status(201).json({
      success: true,
      user: userData,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError('Refresh token required');
    }

    // Verify refresh token
    const { userId } = verifyRefreshToken(refreshToken);

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or disabled');
    }

    // Generate new tokens
    const userData: IUserPublicData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      role: user.role,
    };

    const tokens = generateTokens(userData);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json({
      success: true,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      settings: user.settings,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, validateBody(passwordChangeSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side token invalidation - for stateless JWT, this is a no-op)
router.post('/logout', authenticate, (_req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // For added security, you could implement a token blacklist
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Password reset request
router.post('/password/reset-request', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new BadRequestError('Email is required');
    }

    // Find user - but always return success for security (don't leak whether email exists)
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      // In production, generate a reset token and send email
      // For now, we just log that a reset was requested
      logger.info('Password reset requested', { userId: user.id, email });

      // TODO: Implement email sending with reset link
      // const resetToken = generateResetToken();
      // await storeResetToken(user.id, resetToken);
      // await sendPasswordResetEmail(email, resetToken);
    }

    // Always return success to prevent email enumeration
    res.status(202).json({
      success: true,
      message: 'If the email exists, a password reset link will be sent.',
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };

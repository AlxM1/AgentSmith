/**
 * Two-Factor Authentication Routes
 * Endpoints for 2FA setup, verification, and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../lib/db.js';
import { users } from '@agentsmith/shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';
import { twoFactorService, hashBackupCode } from '../services/TwoFactorService.js';
import { logger } from '../lib/logger.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { config } from '../config/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/auth/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        enabled: user.twoFactorEnabled || false,
        hasBackupCodes: !!(user.twoFactorBackupCodes && (user.twoFactorBackupCodes as string[]).length > 0),
        backupCodesRemaining: user.twoFactorBackupCodes
          ? (user.twoFactorBackupCodes as string[]).filter(c => c).length
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/setup
 * Start 2FA setup process
 */
router.post('/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;

    // Check if 2FA is already enabled
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled. Disable it first to set up again.',
      });
    }

    // Generate 2FA setup
    const setup = await twoFactorService.setup2FA({
      userId,
      email: userEmail,
      issuer: 'AgentSmith',
    });

    // Encrypt and store the secret temporarily (not yet activated)
    const encryptedSecret = await encrypt(setup.secret, config.encryption.key);

    // Hash backup codes
    const hashedBackupCodes = setup.backupCodes.map(code => hashBackupCode(code));

    // Store pending 2FA setup (not yet verified)
    await db.update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: hashedBackupCodes,
        // Don't enable yet - wait for verification
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('2FA setup initiated', { userId });

    res.json({
      success: true,
      data: {
        secret: setup.secret, // Show secret for manual entry
        otpauthUrl: setup.otpauthUrl, // For QR code generation
        qrCodeDataUrl: setup.qrCodeDataUrl,
        backupCodes: setup.backupCodes, // Show once, then they're hashed
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/verify-setup
 * Verify and enable 2FA after setup
 */
router.post('/verify-setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Verification code is required' });
    }

    // Get user with pending 2FA setup
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: '2FA setup not initiated. Start setup first.',
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled.',
      });
    }

    // Decrypt the secret
    const secret = await decrypt(user.twoFactorSecret, config.encryption.key);

    // Verify the code
    const isValid = twoFactorService.verifyTOTP(secret, code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
    }

    // Enable 2FA
    await db.update(users)
      .set({
        twoFactorEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('2FA enabled', { userId });

    res.json({
      success: true,
      data: { message: '2FA has been enabled successfully.' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA for current user
 */
router.post('/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { code, password } = req.body;

    // Require either 2FA code or password for security
    if (!code && !password) {
      return res.status(400).json({
        success: false,
        error: '2FA code or password is required to disable 2FA.',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ success: false, error: '2FA is not enabled.' });
    }

    // Verify authentication
    let authenticated = false;

    if (code && user.twoFactorSecret) {
      const secret = await decrypt(user.twoFactorSecret, config.encryption.key);
      const result = twoFactorService.verify2FA({
        code,
        secret,
        hashedBackupCodes: user.twoFactorBackupCodes as string[],
      });
      authenticated = result.valid;
    }

    // TODO: Also allow password verification if password is provided

    if (!authenticated) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification. Please provide a valid 2FA code.',
      });
    }

    // Disable 2FA
    await db.update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('2FA disabled', { userId });

    res.json({
      success: true,
      data: { message: '2FA has been disabled.' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/regenerate-backup-codes
 * Generate new backup codes
 */
router.post('/regenerate-backup-codes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: '2FA code is required to regenerate backup codes.',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, error: '2FA is not enabled.' });
    }

    // Verify the 2FA code
    const secret = await decrypt(user.twoFactorSecret, config.encryption.key);
    const isValid = twoFactorService.verifyTOTP(secret, code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code.',
      });
    }

    // Generate new backup codes
    const backupCodes = twoFactorService.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(c => hashBackupCode(c));

    // Update stored backup codes
    await db.update(users)
      .set({
        twoFactorBackupCodes: hashedBackupCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('2FA backup codes regenerated', { userId });

    res.json({
      success: true,
      data: {
        backupCodes, // Show the new codes (only time they're visible)
        message: 'New backup codes generated. Save them securely!',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verify a 2FA code (used during login)
 * This is typically called without full authentication
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'User ID and code are required.',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, error: '2FA is not enabled for this user.' });
    }

    // Decrypt the secret
    const secret = await decrypt(user.twoFactorSecret, config.encryption.key);

    // Verify the code
    const result = twoFactorService.verify2FA({
      code,
      secret,
      hashedBackupCodes: user.twoFactorBackupCodes as string[],
    });

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code.',
      });
    }

    // If a backup code was used, mark it as used
    if (result.usedBackupCode) {
      const backupCodes = user.twoFactorBackupCodes as string[];
      const { index } = twoFactorService.verifyBackupCode(code, backupCodes);

      if (index >= 0) {
        backupCodes[index] = ''; // Mark as used
        await db.update(users)
          .set({
            twoFactorBackupCodes: backupCodes,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        logger.info('2FA backup code used', { userId, codeIndex: index });
      }
    }

    logger.info('2FA verification successful', { userId, usedBackupCode: result.usedBackupCode });

    res.json({
      success: true,
      data: {
        verified: true,
        usedBackupCode: result.usedBackupCode,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as twoFactorRouter };

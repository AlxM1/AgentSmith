/**
 * Two-Factor Authentication Service
 *
 * Implements TOTP (Time-based One-Time Password) for 2FA
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */

import crypto from 'crypto';
import { logger } from '../lib/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift
const TOTP_STEP = 30; // 30 second intervals
const TOTP_DIGITS = 6; // 6-digit codes
const SECRET_LENGTH = 20; // 160 bits for secret
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

// ============================================================================
// TYPES
// ============================================================================

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyResult {
  valid: boolean;
  usedBackupCode?: boolean;
}

// ============================================================================
// TOTP IMPLEMENTATION
// ============================================================================

/**
 * Generate a random secret for TOTP
 */
export function generateSecret(): string {
  const buffer = crypto.randomBytes(SECRET_LENGTH);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code for a given secret and time
 */
export function generateTOTP(secret: string, time?: number): string {
  const now = time || Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_STEP);

  return hotp(secret, counter);
}

/**
 * Verify a TOTP code
 */
export function verifyTOTP(secret: string, code: string, window: number = TOTP_WINDOW): boolean {
  if (!code || code.length !== TOTP_DIGITS) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_STEP);

  // Check within window for clock drift
  for (let i = -window; i <= window; i++) {
    const expectedCode = hotp(secret, counter + i);
    if (timingSafeEqual(code, expectedCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate HOTP (HMAC-based One-Time Password)
 */
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  // Generate HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  // Generate 6-digit code
  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================================
// BASE32 ENCODING/DECODING
// ============================================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const index = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ============================================================================
// BACKUP CODES
// ============================================================================

/**
 * Generate backup codes for account recovery
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(code.slice(0, 4) + '-' + code.slice(4));
  }

  return codes;
}

/**
 * Hash a backup code for storage
 */
export function hashBackupCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify a backup code against stored hashes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): { valid: boolean; index: number } {
  const hash = hashBackupCode(code);

  for (let i = 0; i < hashedCodes.length; i++) {
    if (hashedCodes[i] && timingSafeEqual(hash, hashedCodes[i])) {
      return { valid: true, index: i };
    }
  }

  return { valid: false, index: -1 };
}

// ============================================================================
// SETUP HELPERS
// ============================================================================

/**
 * Generate otpauth URL for authenticator apps
 */
export function generateOtpauthUrl(params: {
  secret: string;
  issuer: string;
  accountName: string;
}): string {
  const { secret, issuer, accountName } = params;

  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP}`;
}

/**
 * Generate QR code data URL (using a simple SVG-based approach)
 * For production, consider using a proper QR code library
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  // This is a placeholder - in production, use a library like 'qrcode'
  // For now, we'll return the text encoded in a data URL that the frontend can use
  // to generate a QR code client-side

  // Encode the text for safe inclusion
  const encoded = Buffer.from(text).toString('base64');
  return `data:text/plain;base64,${encoded}`;

  // Production implementation would be:
  // import QRCode from 'qrcode';
  // return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', width: 200 });
}

/**
 * Complete 2FA setup flow
 */
export async function setup2FA(params: {
  userId: string;
  email: string;
  issuer?: string;
}): Promise<TwoFactorSetup> {
  const { userId, email, issuer = 'AgentSmith' } = params;

  // Generate secret
  const secret = generateSecret();

  // Generate otpauth URL
  const otpauthUrl = generateOtpauthUrl({
    secret,
    issuer,
    accountName: email,
  });

  // Generate QR code
  const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  logger.info('2FA setup initiated', { userId, email });

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    backupCodes,
  };
}

/**
 * Verify 2FA code (TOTP or backup code)
 */
export function verify2FA(params: {
  code: string;
  secret: string;
  hashedBackupCodes?: string[];
}): TwoFactorVerifyResult {
  const { code, secret, hashedBackupCodes } = params;

  // Clean the code
  const cleanCode = code.replace(/\s/g, '').replace(/-/g, '');

  // Try TOTP first (6 digits)
  if (cleanCode.length === TOTP_DIGITS && /^\d+$/.test(cleanCode)) {
    if (verifyTOTP(secret, cleanCode)) {
      return { valid: true, usedBackupCode: false };
    }
  }

  // Try backup code (8 characters, may have dash)
  if (hashedBackupCodes && hashedBackupCodes.length > 0) {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    if (normalizedCode.length === BACKUP_CODE_LENGTH) {
      const result = verifyBackupCode(code, hashedBackupCodes);
      if (result.valid) {
        return { valid: true, usedBackupCode: true };
      }
    }
  }

  return { valid: false };
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export const twoFactorService = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  generateOtpauthUrl,
  generateQRCodeDataUrl,
  setup2FA,
  verify2FA,
};

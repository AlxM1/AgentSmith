/**
 * AgentSmith Encryption Module
 * Provides AES-256-GCM encryption for credentials and sensitive data
 * Designed for maximum security in self-hosted environments
 */

import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

// Get encryption key from environment or generate a secure one
function getEncryptionKey(): Buffer {
  const envKey = process.env.AGENTSMITH_ENCRYPTION_KEY;

  if (!envKey) {
    throw new Error(
      'AGENTSMITH_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // If key is hex string (recommended), convert to buffer
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  // If key is raw string, derive a key from it
  const salt = crypto.createHash('sha256').update('agentsmith-salt').digest();
  return crypto.pbkdf2Sync(envKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt data encrypted with the encrypt function
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV, AuthTag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Hash a password using Argon2-like PBKDF2 (for compatibility)
 * In production, consider using argon2 package
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

  // Return salt:hash format
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');

  const verifyHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(hash, verifyHash);
}

/**
 * Generate a secure random token (for API keys, sessions, etc.)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure API key with prefix
 */
export function generateApiKey(prefix: string = 'ask'): string {
  const token = generateSecureToken(24);
  return `${prefix}_${token}`;
}

/**
 * Hash an API key for storage (one-way hash)
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Encrypt credentials object for storage
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  const json = JSON.stringify(credentials);
  return encrypt(json);
}

/**
 * Decrypt credentials from storage
 */
export function decryptCredentials(encryptedCredentials: string): Record<string, unknown> {
  const json = decrypt(encryptedCredentials);
  return JSON.parse(json);
}

/**
 * Mask sensitive data for logging (shows first/last few chars)
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(Math.min(data.length - visibleChars * 2, 20));

  return `${start}${masked}${end}`;
}

/**
 * Sanitize object by removing sensitive keys before logging
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password', 'secret', 'token', 'apiKey', 'api_key', 'apikey',
    'authorization', 'auth', 'credential', 'private', 'key',
    'accessToken', 'access_token', 'refreshToken', 'refresh_token',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()));

    if (isSensitive && typeof value === 'string') {
      sanitized[key] = maskSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

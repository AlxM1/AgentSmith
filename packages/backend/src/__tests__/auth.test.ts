// Authentication Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock configuration
const mockConfig = {
  jwtSecret: 'test-jwt-secret-for-testing',
  jwtRefreshSecret: 'test-refresh-secret',
  jwtExpiresIn: '1h',
  jwtRefreshExpiresIn: '7d'
};

// Simple auth helper functions for testing
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    mockConfig.jwtSecret,
    { expiresIn: mockConfig.jwtExpiresIn }
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    mockConfig.jwtRefreshSecret,
    { expiresIn: mockConfig.jwtRefreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret);
};

describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'securePassword123';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash.startsWith('$2a$')).toBe(true);
    });

    it('should verify correct password', async () => {
      const password = 'securePassword123';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'securePassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should generate unique hashes for same password', async () => {
      const password = 'securePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate access and refresh tokens', () => {
      const userId = 'user_123';
      const email = 'test@example.com';

      const tokens = generateTokens(userId, email);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens.accessToken.length).toBeGreaterThan(0);
      expect(tokens.refreshToken.length).toBeGreaterThan(0);
    });

    it('should create valid access token', () => {
      const userId = 'user_123';
      const email = 'test@example.com';

      const { accessToken } = generateTokens(userId, email);
      const decoded = verifyToken(accessToken, mockConfig.jwtSecret) as { userId: string; email: string };

      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
    });

    it('should create valid refresh token', () => {
      const userId = 'user_123';
      const email = 'test@example.com';

      const { refreshToken } = generateTokens(userId, email);
      const decoded = verifyToken(refreshToken, mockConfig.jwtRefreshSecret) as { userId: string; email: string; type: string };

      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe('refresh');
    });

    it('should fail to verify with wrong secret', () => {
      const userId = 'user_123';
      const email = 'test@example.com';

      const { accessToken } = generateTokens(userId, email);

      expect(() => {
        verifyToken(accessToken, 'wrong-secret');
      }).toThrow();
    });
  });

  describe('Token Expiration', () => {
    it('should include expiration in access token', () => {
      const userId = 'user_123';
      const email = 'test@example.com';

      const { accessToken } = generateTokens(userId, email);
      const decoded = jwt.decode(accessToken) as { exp: number; iat: number };

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should reject expired tokens', async () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@example.com' },
        mockConfig.jwtSecret,
        { expiresIn: '0s' }
      );

      // Wait a moment for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(() => {
        verifyToken(expiredToken, mockConfig.jwtSecret);
      }).toThrow();
    });
  });

  describe('Email Validation', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('Password Validation', () => {
    const isValidPassword = (password: string): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      return { valid: errors.length === 0, errors };
    };

    it('should accept strong passwords', () => {
      const result = isValidPassword('SecurePass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = isValidPassword('Abc1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should require uppercase letters', () => {
      const result = isValidPassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = isValidPassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = isValidPassword('NoNumbers');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });
});

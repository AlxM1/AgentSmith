// @ts-nocheck
/**
 * SSO Service - OAuth2/OIDC Integration
 *
 * Supports multiple identity providers:
 * - Google
 * - GitHub
 * - Microsoft Azure AD
 * - Okta
 * - Generic OIDC
 * - SAML 2.0 (via OIDC bridge)
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SSOProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  // OIDC specific
  issuer?: string;
  jwksUri?: string;
  // Custom mappings
  attributeMapping?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    groups?: string;
  };
}

export interface SSOUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  groups?: string[];
  provider: string;
  raw: Record<string, unknown>;
}

export interface OAuthState {
  provider: string;
  nonce: string;
  redirectUri: string;
  timestamp: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

// ============================================================================
// DEFAULT PROVIDERS
// ============================================================================

const DEFAULT_PROVIDERS: Record<string, Partial<SSOProvider>> = {
  google: {
    name: 'Google',
    type: 'oidc',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    issuer: 'https://accounts.google.com',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    scopes: ['openid', 'email', 'profile'],
    attributeMapping: {
      id: 'sub',
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      displayName: 'name',
      avatar: 'picture',
    },
  },
  github: {
    name: 'GitHub',
    type: 'oauth2',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'read:user'],
    attributeMapping: {
      id: 'id',
      email: 'email',
      displayName: 'name',
      avatar: 'avatar_url',
    },
  },
  microsoft: {
    name: 'Microsoft',
    type: 'oidc',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    issuer: 'https://login.microsoftonline.com/common/v2.0',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    attributeMapping: {
      id: 'id',
      email: 'mail',
      firstName: 'givenName',
      lastName: 'surname',
      displayName: 'displayName',
    },
  },
  okta: {
    name: 'Okta',
    type: 'oidc',
    // URLs are organization-specific, filled in from config
    scopes: ['openid', 'email', 'profile', 'groups'],
    attributeMapping: {
      id: 'sub',
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      displayName: 'name',
      groups: 'groups',
    },
  },
};

// ============================================================================
// SSO SERVICE
// ============================================================================

class SSOService {
  private providers: Map<string, SSOProvider> = new Map();
  private stateStore: Map<string, OAuthState> = new Map();
  private readonly stateExpiry = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.loadProvidersFromConfig();
    this.startStateCleanup();
  }

  /**
   * Load SSO providers from configuration
   */
  private loadProvidersFromConfig(): void {
    const ssoConfig = (config.sso || {}) as any;

    // Load Google if configured
    if (ssoConfig.google?.clientId) {
      this.registerProvider('google', {
        ...DEFAULT_PROVIDERS.google,
        id: 'google',
        enabled: ssoConfig.google.enabled !== false,
        clientId: ssoConfig.google.clientId,
        clientSecret: ssoConfig.google.clientSecret,
      } as SSOProvider);
    }

    // Load GitHub if configured
    if (ssoConfig.github?.clientId) {
      this.registerProvider('github', {
        ...DEFAULT_PROVIDERS.github,
        id: 'github',
        enabled: ssoConfig.github.enabled !== false,
        clientId: ssoConfig.github.clientId,
        clientSecret: ssoConfig.github.clientSecret,
      } as SSOProvider);
    }

    // Load Microsoft if configured
    if (ssoConfig.microsoft?.clientId) {
      this.registerProvider('microsoft', {
        ...DEFAULT_PROVIDERS.microsoft,
        id: 'microsoft',
        enabled: ssoConfig.microsoft.enabled !== false,
        clientId: ssoConfig.microsoft.clientId,
        clientSecret: ssoConfig.microsoft.clientSecret,
        // Allow tenant-specific URLs
        authorizationUrl: ssoConfig.microsoft.tenantId
          ? `https://login.microsoftonline.com/${ssoConfig.microsoft.tenantId}/oauth2/v2.0/authorize`
          : DEFAULT_PROVIDERS.microsoft.authorizationUrl!,
        tokenUrl: ssoConfig.microsoft.tenantId
          ? `https://login.microsoftonline.com/${ssoConfig.microsoft.tenantId}/oauth2/v2.0/token`
          : DEFAULT_PROVIDERS.microsoft.tokenUrl!,
      } as SSOProvider);
    }

    // Load Okta if configured
    if (ssoConfig.okta?.domain && ssoConfig.okta?.clientId) {
      const oktaDomain = ssoConfig.okta.domain;
      this.registerProvider('okta', {
        ...DEFAULT_PROVIDERS.okta,
        id: 'okta',
        enabled: ssoConfig.okta.enabled !== false,
        clientId: ssoConfig.okta.clientId,
        clientSecret: ssoConfig.okta.clientSecret,
        authorizationUrl: `https://${oktaDomain}/oauth2/v1/authorize`,
        tokenUrl: `https://${oktaDomain}/oauth2/v1/token`,
        userInfoUrl: `https://${oktaDomain}/oauth2/v1/userinfo`,
        issuer: `https://${oktaDomain}`,
        jwksUri: `https://${oktaDomain}/oauth2/v1/keys`,
      } as SSOProvider);
    }

    // Load generic OIDC if configured
    if (ssoConfig.oidc?.clientId) {
      this.registerProvider('oidc', {
        id: 'oidc',
        name: ssoConfig.oidc.name || 'SSO',
        type: 'oidc',
        enabled: ssoConfig.oidc.enabled !== false,
        clientId: ssoConfig.oidc.clientId,
        clientSecret: ssoConfig.oidc.clientSecret,
        authorizationUrl: ssoConfig.oidc.authorizationUrl,
        tokenUrl: ssoConfig.oidc.tokenUrl,
        userInfoUrl: ssoConfig.oidc.userInfoUrl,
        issuer: ssoConfig.oidc.issuer,
        jwksUri: ssoConfig.oidc.jwksUri,
        scopes: ssoConfig.oidc.scopes || ['openid', 'email', 'profile'],
        attributeMapping: ssoConfig.oidc.attributeMapping || {
          id: 'sub',
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          displayName: 'name',
        },
      } as SSOProvider);
    }

    logger.info('SSO providers loaded', {
      providers: Array.from(this.providers.keys()),
    });
  }

  /**
   * Register an SSO provider
   */
  registerProvider(id: string, provider: SSOProvider): void {
    this.providers.set(id, provider);
    logger.debug(`Registered SSO provider: ${id}`);
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): Array<{ id: string; name: string; type: string }> {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .map(p => ({ id: p.id, name: p.name, type: p.type }));
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): SSOProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Generate authorization URL for a provider
   */
  generateAuthUrl(providerId: string, redirectUri: string): string {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) {
      throw new Error(`SSO provider not found or disabled: ${providerId}`);
    }

    // Generate state and nonce for security
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = crypto.randomBytes(32).toString('hex');

    // Store state for verification
    this.stateStore.set(state, {
      provider: providerId,
      nonce,
      redirectUri,
      timestamp: Date.now(),
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
    });

    // Add OIDC-specific params
    if (provider.type === 'oidc') {
      params.set('nonce', nonce);
      params.set('response_mode', 'query');
    }

    return `${provider.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<{ user: SSOUser; tokens: TokenResponse }> {
    // Verify state
    const storedState = this.stateStore.get(state);
    if (!storedState) {
      throw new Error('Invalid or expired state parameter');
    }

    // Check expiry
    if (Date.now() - storedState.timestamp > this.stateExpiry) {
      this.stateStore.delete(state);
      throw new Error('State parameter expired');
    }

    // Get provider
    const provider = this.providers.get(storedState.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${storedState.provider}`);
    }

    // Clean up state
    this.stateStore.delete(state);

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(provider, code, redirectUri);

    // Get user info
    const user = await this.getUserInfo(provider, tokens);

    logger.info('SSO login successful', {
      provider: provider.id,
      userId: user.id,
      email: user.email,
    });

    return { user, tokens };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    provider: SSOProvider,
    code: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    try {
      const response = await axios.post<TokenResponse>(provider.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      logger.error('Token exchange failed', {
        provider: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Get user info from provider
   */
  private async getUserInfo(provider: SSOProvider, tokens: TokenResponse): Promise<SSOUser> {
    // For OIDC, try to decode ID token first
    if (provider.type === 'oidc' && tokens.id_token) {
      try {
        // Decode without verification for now (in production, verify against JWKS)
        const decoded = jwt.decode(tokens.id_token) as Record<string, unknown>;
        if (decoded) {
          return this.mapUserInfo(provider, decoded);
        }
      } catch (error) {
        logger.warn('Failed to decode ID token, falling back to userinfo endpoint');
      }
    }

    // Fall back to userinfo endpoint
    if (provider.userInfoUrl) {
      try {
        const response = await axios.get<Record<string, unknown>>(provider.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        return this.mapUserInfo(provider, response.data);
      } catch (error) {
        logger.error('Failed to fetch user info', {
          provider: provider.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error('Failed to fetch user information');
      }
    }

    throw new Error('No method available to get user info');
  }

  /**
   * Map provider user data to standard format
   */
  private mapUserInfo(provider: SSOProvider, data: Record<string, unknown>): SSOUser {
    const mapping = provider.attributeMapping || {};

    const getValue = (key: string | undefined): unknown => {
      if (!key) return undefined;
      // Support nested paths like "profile.email"
      const parts = key.split('.');
      let value: unknown = data;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return value;
    };

    const id = String(getValue(mapping.id) || data.id || data.sub || '');
    const email = String(getValue(mapping.email) || data.email || '');

    if (!id || !email) {
      throw new Error('User ID and email are required');
    }

    return {
      id,
      email,
      firstName: getValue(mapping.firstName) as string | undefined,
      lastName: getValue(mapping.lastName) as string | undefined,
      displayName: getValue(mapping.displayName) as string | undefined,
      avatar: getValue(mapping.avatar) as string | undefined,
      groups: getValue(mapping.groups) as string[] | undefined,
      provider: provider.id,
      raw: data,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(providerId: string, refreshToken: string): Promise<TokenResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      const response = await axios.post<TokenResponse>(provider.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      logger.error('Token refresh failed', {
        provider: providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Clean up expired states
   */
  private startStateCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [state, data] of this.stateStore) {
        if (now - data.timestamp > this.stateExpiry) {
          this.stateStore.delete(state);
        }
      }
    }, 60000); // Run every minute
  }
}

// Export singleton instance
export const ssoService = new SSOService();

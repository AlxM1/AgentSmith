// Configuration

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  appName: process.env.APP_NAME || 'AgentSmith',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map(s => s.trim()),

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'agentsmith',
    username: process.env.DB_USERNAME || 'agentsmith',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Encryption (for credentials)
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'your-32-char-encryption-key-here',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Worker
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WORKER_RETRY_DELAY || '5000', 10),
  },

  // Webhooks
  webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:4000/webhooks',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Storage
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    path: process.env.STORAGE_PATH || './storage',
  },

  // Email
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    fromName: process.env.EMAIL_FROM_NAME || 'AgentSmith',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    templates: {
      path: process.env.EMAIL_TEMPLATES_PATH || './templates/email',
    },
  },

  // JWT Secret (alias for backward compatibility)
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',

  // High Availability
  ha: {
    enabled: process.env.HA_ENABLED === 'true',
    instanceId: process.env.HA_INSTANCE_ID || `instance-${process.pid}`,
    heartbeatInterval: parseInt(process.env.HA_HEARTBEAT_INTERVAL || '5000', 10),
    leaderElectionTimeout: parseInt(process.env.HA_LEADER_TIMEOUT || '30000', 10),
  },

  // SSO Configuration
  sso: {
    enabled: process.env.SSO_ENABLED === 'true',
    saml: {
      enabled: process.env.SSO_SAML_ENABLED === 'true',
      entryPoint: process.env.SSO_SAML_ENTRY_POINT || '',
      issuer: process.env.SSO_SAML_ISSUER || '',
      cert: process.env.SSO_SAML_CERT || '',
      callbackUrl: process.env.SSO_SAML_CALLBACK_URL || '',
    },
    oidc: {
      enabled: process.env.SSO_OIDC_ENABLED === 'true',
      clientId: process.env.SSO_OIDC_CLIENT_ID || '',
      clientSecret: process.env.SSO_OIDC_CLIENT_SECRET || '',
      issuer: process.env.SSO_OIDC_ISSUER || '',
      authorizationUrl: process.env.SSO_OIDC_AUTH_URL || '',
      tokenUrl: process.env.SSO_OIDC_TOKEN_URL || '',
      userInfoUrl: process.env.SSO_OIDC_USERINFO_URL || '',
      callbackUrl: process.env.SSO_OIDC_CALLBACK_URL || '',
      name: process.env.SSO_OIDC_NAME || 'SSO',
      jwksUri: process.env.SSO_OIDC_JWKS_URI || '',
      scopes: (process.env.SSO_OIDC_SCOPES || 'openid,email,profile').split(','),
      attributeMapping: undefined as Record<string, string> | undefined,
    },
    ldap: {
      enabled: process.env.SSO_LDAP_ENABLED === 'true',
      url: process.env.SSO_LDAP_URL || '',
      bindDN: process.env.SSO_LDAP_BIND_DN || '',
      bindPassword: process.env.SSO_LDAP_BIND_PASSWORD || '',
      searchBase: process.env.SSO_LDAP_SEARCH_BASE || '',
      searchFilter: process.env.SSO_LDAP_SEARCH_FILTER || '(uid={{username}})',
    },
    // OAuth Providers
    google: {
      enabled: process.env.SSO_GOOGLE_ENABLED === 'true',
      clientId: process.env.SSO_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.SSO_GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      enabled: process.env.SSO_GITHUB_ENABLED === 'true',
      clientId: process.env.SSO_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.SSO_GITHUB_CLIENT_SECRET || '',
    },
    microsoft: {
      enabled: process.env.SSO_MICROSOFT_ENABLED === 'true',
      clientId: process.env.SSO_MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.SSO_MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.SSO_MICROSOFT_TENANT_ID || '',
    },
    okta: {
      enabled: process.env.SSO_OKTA_ENABLED === 'true',
      domain: process.env.SSO_OKTA_DOMAIN || '',
      clientId: process.env.SSO_OKTA_CLIENT_ID || '',
      clientSecret: process.env.SSO_OKTA_CLIENT_SECRET || '',
    },
  },
};

// Validate required configuration
export function validateConfig() {
  const required = ['JWT_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

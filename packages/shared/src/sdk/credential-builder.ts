// Credential Builder - Create n8n-compatible credential types

import type {
  ICredentialType,
  INodeProperties,
  IAuthenticate,
  ICredentialTestRequest,
  IDataObject,
  IRequestOptions,
} from './types.js';

// ============================================
// Credential Builder Types
// ============================================

export interface CredentialConfig {
  name: string;
  displayName: string;
  documentationUrl?: string;
  icon?: string;
  iconColor?: string;
  properties: INodeProperties[];
  authenticate?: AuthenticateConfig;
  test?: TestConfig;
  extends?: string[];
}

export interface AuthenticateConfig {
  type: 'apiKey' | 'basicAuth' | 'bearerToken' | 'oAuth2' | 'custom';
  // For API Key
  apiKey?: {
    location: 'header' | 'query' | 'body';
    name: string;
    prefix?: string;
  };
  // For Basic Auth
  basicAuth?: {
    usernameField?: string;
    passwordField?: string;
  };
  // For Bearer Token
  bearerToken?: {
    tokenField?: string;
  };
  // For custom headers/body/qs
  custom?: {
    headers?: Record<string, string>;
    body?: IDataObject;
    qs?: Record<string, string>;
  };
}

export interface TestConfig {
  request: {
    method?: 'GET' | 'POST';
    url: string;
    baseURL?: string;
  };
}

// ============================================
// Credential Builder Function
// ============================================

/**
 * Create an n8n-compatible credential type
 */
export function createCredentialType(config: CredentialConfig): ICredentialType {
  const credential: ICredentialType = {
    name: config.name,
    displayName: config.displayName,
    documentationUrl: config.documentationUrl,
    icon: config.icon,
    iconColor: config.iconColor,
    properties: config.properties,
    extends: config.extends,
  };

  // Build authenticate config
  if (config.authenticate) {
    credential.authenticate = buildAuthenticate(config.authenticate);
  }

  // Build test config
  if (config.test) {
    credential.test = {
      request: config.test.request as IRequestOptions,
    };
  }

  return credential;
}

function buildAuthenticate(config: AuthenticateConfig): IAuthenticate {
  const properties: IAuthenticate['properties'] = {};

  switch (config.type) {
    case 'apiKey':
      if (config.apiKey) {
        const value = config.apiKey.prefix
          ? `=${config.apiKey.prefix}{{$credentials.apiKey}}`
          : '={{$credentials.apiKey}}';

        if (config.apiKey.location === 'header') {
          properties.headers = { [config.apiKey.name]: value };
        } else if (config.apiKey.location === 'query') {
          properties.qs = { [config.apiKey.name]: value };
        } else if (config.apiKey.location === 'body') {
          properties.body = { [config.apiKey.name]: value };
        }
      }
      break;

    case 'basicAuth':
      properties.auth = {
        username: `={{$credentials.${config.basicAuth?.usernameField || 'username'}}}`,
        password: `={{$credentials.${config.basicAuth?.passwordField || 'password'}}}`,
      };
      break;

    case 'bearerToken':
      properties.headers = {
        Authorization: `=Bearer {{$credentials.${config.bearerToken?.tokenField || 'token'}}}`,
      };
      break;

    case 'custom':
      if (config.custom?.headers) {
        properties.headers = config.custom.headers;
      }
      if (config.custom?.body) {
        properties.body = config.custom.body;
      }
      if (config.custom?.qs) {
        properties.qs = config.custom.qs;
      }
      break;
  }

  return {
    type: 'generic',
    properties,
  };
}

// ============================================
// Pre-built Credential Templates
// ============================================

/**
 * Create an API Key credential
 */
export function createApiKeyCredential(options: {
  name: string;
  displayName: string;
  documentationUrl?: string;
  headerName?: string;
  headerPrefix?: string;
  testUrl?: string;
}): ICredentialType {
  return createCredentialType({
    name: options.name,
    displayName: options.displayName,
    documentationUrl: options.documentationUrl,
    properties: [
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
      },
    ],
    authenticate: {
      type: 'apiKey',
      apiKey: {
        location: 'header',
        name: options.headerName || 'Authorization',
        prefix: options.headerPrefix || 'Bearer ',
      },
    },
    test: options.testUrl
      ? {
          request: {
            method: 'GET',
            url: options.testUrl,
          },
        }
      : undefined,
  });
}

/**
 * Create a Basic Auth credential
 */
export function createBasicAuthCredential(options: {
  name: string;
  displayName: string;
  documentationUrl?: string;
  testUrl?: string;
}): ICredentialType {
  return createCredentialType({
    name: options.name,
    displayName: options.displayName,
    documentationUrl: options.documentationUrl,
    properties: [
      {
        displayName: 'Username',
        name: 'username',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Password',
        name: 'password',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
      },
    ],
    authenticate: {
      type: 'basicAuth',
    },
    test: options.testUrl
      ? {
          request: {
            method: 'GET',
            url: options.testUrl,
          },
        }
      : undefined,
  });
}

/**
 * Create an OAuth2 credential (placeholder - full OAuth2 requires more implementation)
 */
export function createOAuth2Credential(options: {
  name: string;
  displayName: string;
  documentationUrl?: string;
  authorizationUrl: string;
  accessTokenUrl: string;
  scope?: string[];
}): ICredentialType {
  return createCredentialType({
    name: options.name,
    displayName: options.displayName,
    documentationUrl: options.documentationUrl,
    properties: [
      {
        displayName: 'Client ID',
        name: 'clientId',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Client Secret',
        name: 'clientSecret',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
      },
      {
        displayName: 'Authorization URL',
        name: 'authorizationUrl',
        type: 'hidden',
        default: options.authorizationUrl,
      },
      {
        displayName: 'Access Token URL',
        name: 'accessTokenUrl',
        type: 'hidden',
        default: options.accessTokenUrl,
      },
      {
        displayName: 'Scope',
        name: 'scope',
        type: 'hidden',
        default: options.scope?.join(' ') || '',
      },
      {
        displayName: 'Access Token',
        name: 'accessToken',
        type: 'hidden',
        default: '',
      },
      {
        displayName: 'Refresh Token',
        name: 'refreshToken',
        type: 'hidden',
        default: '',
      },
    ],
    authenticate: {
      type: 'bearerToken',
      bearerToken: {
        tokenField: 'accessToken',
      },
    },
  });
}

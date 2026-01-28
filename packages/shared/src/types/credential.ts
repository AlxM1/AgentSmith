// Credential Type Definitions

export type CredentialType = 'apiKey' | 'oauth2' | 'basicAuth' | 'bearerToken' | 'custom';

export interface ICredential {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sharedWith?: ICredentialShare[];
}

export interface ICredentialShare {
  userId: string;
  accessLevel: 'read' | 'write';
}

export interface ICredentialCreateInput {
  name: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ICredentialUpdateInput {
  name?: string;
  data?: Record<string, unknown>;
}

export interface ICredentialListItem {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  nodesWithAccess: ICredentialNodeAccess[];
}

export interface ICredentialNodeAccess {
  nodeType: string;
  date: Date;
}

export interface ICredentialType {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  iconColor?: string;
  documentationUrl?: string;
  properties: ICredentialProperty[];
  authenticate?: ICredentialAuthenticate;
  test?: ICredentialTest;
  genericAuth?: boolean;
}

export interface ICredentialProperty {
  name: string;
  displayName: string;
  type: CredentialPropertyType;
  default?: unknown;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: ICredentialPropertyOption[];
  displayOptions?: ICredentialDisplayOptions;
  typeOptions?: ICredentialPropertyTypeOptions;
}

export type CredentialPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'options'
  | 'hidden';

export interface ICredentialPropertyOption {
  name: string;
  value: string | number | boolean;
}

export interface ICredentialDisplayOptions {
  show?: Record<string, unknown[]>;
  hide?: Record<string, unknown[]>;
}

export interface ICredentialPropertyTypeOptions {
  password?: boolean;
  rows?: number;
  minValue?: number;
  maxValue?: number;
}

export interface ICredentialAuthenticate {
  type: 'generic' | 'custom';
  properties?: Record<string, unknown>;
}

export interface ICredentialTest {
  request: ICredentialTestRequest;
}

export interface ICredentialTestRequest {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Built-in credential types
export const CORE_CREDENTIAL_TYPES = {
  OPENAI_API: 'openAiApi',
  ANTHROPIC_API: 'anthropicApi',
  HTTP_BASIC_AUTH: 'httpBasicAuth',
  HTTP_HEADER_AUTH: 'httpHeaderAuth',
  HTTP_QUERY_AUTH: 'httpQueryAuth',
  OAUTH2: 'oAuth2Api',
  SMTP: 'smtp',
  POSTGRES: 'postgres',
  MYSQL: 'mysql',
  MONGODB: 'mongodb',
  REDIS: 'redis',
  SLACK_API: 'slackApi',
  GITHUB_API: 'githubApi',
  GOOGLE_API: 'googleApi',
  AWS: 'aws',
} as const;

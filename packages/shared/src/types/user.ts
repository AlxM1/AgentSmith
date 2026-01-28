// User Type Definitions

export type UserRole = 'admin' | 'user' | 'viewer';

export interface IUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  isPending: boolean;
  settings?: IUserSettings;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface IUserSettings {
  theme: 'light' | 'dark' | 'system';
  locale: string;
  timezone: string;
  dateFormat: string;
  notifications: IUserNotificationSettings;
}

export interface IUserNotificationSettings {
  emailOnExecutionFailure: boolean;
  emailOnExecutionSuccess: boolean;
  emailDigest: 'never' | 'daily' | 'weekly';
}

export interface IUserCreateInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface IUserUpdateInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
  settings?: Partial<IUserSettings>;
}

export interface IUserPublicData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface IAuthResponse {
  user: IUserPublicData;
  tokens: IAuthTokens;
}

export interface IPasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export interface IPasswordResetRequest {
  email: string;
}

export interface IPasswordResetConfirm {
  token: string;
  password: string;
}

export interface IApiKey {
  id: string;
  label: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface IApiKeyCreateInput {
  label: string;
  expiresAt?: Date;
}

export interface IApiKeyWithSecret extends IApiKey {
  key: string;
}

export const defaultUserSettings: IUserSettings = {
  theme: 'system',
  locale: 'en',
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  notifications: {
    emailOnExecutionFailure: true,
    emailOnExecutionSuccess: false,
    emailDigest: 'never',
  },
};

// ID Generation Utilities

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 21;

/**
 * Generate a unique ID using a URL-safe alphabet
 */
export function generateId(length: number = ID_LENGTH): string {
  let id = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return id;
}

/**
 * Generate a workflow ID with prefix
 */
export function generateWorkflowId(): string {
  return `wf_${generateId(16)}`;
}

/**
 * Generate an execution ID with prefix
 */
export function generateExecutionId(): string {
  return `ex_${generateId(16)}`;
}

/**
 * Generate a node ID with prefix
 */
export function generateNodeId(): string {
  return `nd_${generateId(12)}`;
}

/**
 * Generate a credential ID with prefix
 */
export function generateCredentialId(): string {
  return `cr_${generateId(16)}`;
}

/**
 * Generate a user ID with prefix
 */
export function generateUserId(): string {
  return `us_${generateId(16)}`;
}

/**
 * Generate a webhook ID with prefix
 */
export function generateWebhookId(): string {
  return `wh_${generateId(16)}`;
}

/**
 * Generate an API key
 */
export function generateApiKey(): string {
  return `as_${generateId(32)}`;
}

/**
 * Validate ID format
 */
export function isValidId(id: string, prefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;

  if (prefix) {
    return id.startsWith(`${prefix}_`) && id.length > prefix.length + 1;
  }

  return /^[a-zA-Z0-9_-]+$/.test(id);
}

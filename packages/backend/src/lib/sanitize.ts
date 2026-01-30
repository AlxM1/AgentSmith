// Input Sanitization Service
// Centralized sanitization for preventing XSS and injection attacks

/**
 * HTML entities to escape
 */
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char] || char);
}

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for safe output
 * Removes null bytes, control characters, and escapes HTML
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return String(input ?? '');
  }

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Unicode
    .normalize('NFC')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize and escape HTML in a string
 */
export function sanitizeAndEscape(input: unknown): string {
  const sanitized = sanitizeString(input);
  return escapeHtml(sanitized);
}

/**
 * Sanitize a filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    // Remove path traversal attempts
    .replace(/\.\./g, '')
    // Remove path separators
    .replace(/[/\\]/g, '')
    // Remove null bytes and control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove other dangerous characters
    .replace(/[<>:"|?*]/g, '')
    // Limit length
    .slice(0, 255)
    .trim();
}

/**
 * Sanitize a URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeString(url);

  // Block dangerous protocols
  const lowerUrl = sanitized.toLowerCase().trim();
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:')
  ) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email).toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);

    if (value === null || value === undefined) {
      result[sanitizedKey] = value;
    } else if (typeof value === 'string') {
      result[sanitizedKey] = sanitizeString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map(item => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else if (typeof value === 'object') {
      result[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[sanitizedKey] = value;
    }
  }

  return result as T;
}

/**
 * Sanitize SQL identifier (table name, column name)
 * Only allows alphanumeric and underscores
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
}

/**
 * Sanitize JSON string
 * Parses and re-stringifies to ensure valid JSON
 */
export function sanitizeJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    const sanitized = sanitizeObject(parsed);
    return JSON.stringify(sanitized);
  } catch {
    return '{}';
  }
}

/**
 * Sanitize workflow node parameters
 */
export function sanitizeNodeParameters(params: Record<string, unknown>): Record<string, unknown> {
  return sanitizeObject(params);
}

/**
 * Create a sanitization middleware for Express
 */
export function sanitizationMiddleware() {
  return (req: any, res: any, next: any) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeString(value);
        }
      }
    }

    // Sanitize path parameters
    if (req.params && typeof req.params === 'object') {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = sanitizeString(value);
        }
      }
    }

    next();
  };
}

/**
 * Validate and sanitize a password
 * Returns sanitized password or throws error
 */
export function validatePassword(password: string): string {
  const sanitized = sanitizeString(password);

  if (sanitized.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  if (sanitized.length > 128) {
    throw new Error('Password must be less than 128 characters');
  }

  return sanitized;
}

export default {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeAndEscape,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeObject,
  sanitizeSqlIdentifier,
  sanitizeJson,
  sanitizeNodeParameters,
  sanitizationMiddleware,
  validatePassword,
};

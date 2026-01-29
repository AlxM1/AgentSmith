/**
 * Secure Code Sandbox
 *
 * Provides isolated JavaScript execution environment using vm2
 * Prevents access to Node.js internals, file system, network, etc.
 */

import { VM, VMScript } from 'vm2';
import { logger } from './logger.js';

// Types for execution context
export interface SandboxContext {
  items: unknown[];
  $input: {
    all: () => unknown[];
    first: () => unknown;
    last: () => unknown;
    item: unknown;
  };
  $json: Record<string, unknown>;
  $node: {
    name: string;
    id: string;
  };
  $execution: {
    id: string;
    mode: string;
  };
  console: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  // Safe utilities
  JSON: typeof JSON;
  Math: typeof Math;
  Date: typeof Date;
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Error: typeof Error;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  // Utility functions
  $helpers: {
    isEmpty: (value: unknown) => boolean;
    isNumber: (value: unknown) => boolean;
    isString: (value: unknown) => boolean;
    isArray: (value: unknown) => boolean;
    isObject: (value: unknown) => boolean;
    toNumber: (value: unknown) => number;
    toString: (value: unknown) => string;
    toBoolean: (value: unknown) => boolean;
    toDate: (value: unknown) => Date;
    randomInt: (min: number, max: number) => number;
    randomString: (length: number) => string;
    sleep: (ms: number) => Promise<void>;
    chunk: <T>(array: T[], size: number) => T[][];
    unique: <T>(array: T[]) => T[];
    groupBy: <T>(array: T[], key: keyof T) => Record<string, T[]>;
  };
}

export interface SandboxOptions {
  timeout?: number; // Maximum execution time in ms
  memoryLimit?: number; // Memory limit in MB (not fully enforced by vm2)
  nodeId?: string;
  nodeName?: string;
  executionId?: string;
  executionMode?: string;
}

// Log accumulator for capturing console output
interface LogEntry {
  level: 'log' | 'warn' | 'error';
  args: unknown[];
  timestamp: Date;
}

/**
 * Execute JavaScript code in a secure sandbox
 */
export async function executeSandboxed<T = unknown>(
  code: string,
  items: unknown[],
  options: SandboxOptions = {}
): Promise<{
  result: T;
  logs: LogEntry[];
  executionTime: number;
}> {
  const startTime = Date.now();
  const logs: LogEntry[] = [];

  const {
    timeout = 30000, // 30 seconds default
    nodeId = 'unknown',
    nodeName = 'Code',
    executionId = 'unknown',
    executionMode = 'manual',
  } = options;

  // Create sandbox context
  const sandbox: SandboxContext = {
    items,
    $input: {
      all: () => items,
      first: () => items[0],
      last: () => items[items.length - 1],
      item: items[0],
    },
    $json: (items[0] as { json?: Record<string, unknown> })?.json || {},
    $node: {
      name: nodeName,
      id: nodeId,
    },
    $execution: {
      id: executionId,
      mode: executionMode,
    },
    console: {
      log: (...args: unknown[]) => {
        logs.push({ level: 'log', args, timestamp: new Date() });
      },
      warn: (...args: unknown[]) => {
        logs.push({ level: 'warn', args, timestamp: new Date() });
      },
      error: (...args: unknown[]) => {
        logs.push({ level: 'error', args, timestamp: new Date() });
      },
    },
    // Safe built-ins
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Map,
    Set,
    Promise,
    // Helpers
    $helpers: {
      isEmpty: (value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
      },
      isNumber: (value: unknown) => typeof value === 'number' && !isNaN(value),
      isString: (value: unknown) => typeof value === 'string',
      isArray: (value: unknown) => Array.isArray(value),
      isObject: (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value),
      toNumber: (value: unknown) => Number(value),
      toString: (value: unknown) => String(value),
      toBoolean: (value: unknown) => Boolean(value),
      toDate: (value: unknown) => new Date(value as string | number),
      randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      randomString: (length: number) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      },
      sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 10000))), // Max 10s
      chunk: <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
          chunks.push(array.slice(i, i + size));
        }
        return chunks;
      },
      unique: <T>(array: T[]): T[] => [...new Set(array)],
      groupBy: <T>(array: T[], key: keyof T): Record<string, T[]> => {
        return array.reduce((groups, item) => {
          const groupKey = String(item[key]);
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(item);
          return groups;
        }, {} as Record<string, T[]>);
      },
    },
  };

  // Create VM with strict security settings
  const vm = new VM({
    timeout,
    sandbox,
    eval: false, // Disable eval()
    wasm: false, // Disable WebAssembly
    fixAsync: true, // Handle async properly
  });

  // Wrap code in async IIFE to support await
  const wrappedCode = `
    (async () => {
      ${code}
    })()
  `;

  try {
    // Compile and run the script
    const script = new VMScript(wrappedCode);
    const result = await vm.run(script);

    const executionTime = Date.now() - startTime;

    logger.debug('Sandbox execution completed', {
      nodeId,
      executionTime,
      logsCount: logs.length,
    });

    return {
      result: result as T,
      logs,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('Sandbox execution failed', {
      nodeId,
      executionTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new SandboxError(
      `Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { nodeId, executionTime, logs }
    );
  }
}

/**
 * Custom error class for sandbox execution failures
 */
export class SandboxError extends Error {
  public nodeId: string;
  public executionTime: number;
  public logs: LogEntry[];

  constructor(
    message: string,
    details: { nodeId: string; executionTime: number; logs: LogEntry[] }
  ) {
    super(message);
    this.name = 'SandboxError';
    this.nodeId = details.nodeId;
    this.executionTime = details.executionTime;
    this.logs = details.logs;
  }
}

/**
 * Validate code before execution
 * Checks for potentially dangerous patterns
 */
export function validateCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Patterns that should never appear in user code
  const dangerousPatterns = [
    { pattern: /require\s*\(/g, message: 'require() is not allowed' },
    { pattern: /import\s+/g, message: 'import statements are not allowed' },
    { pattern: /process\./g, message: 'process object is not allowed' },
    { pattern: /__dirname/g, message: '__dirname is not allowed' },
    { pattern: /__filename/g, message: '__filename is not allowed' },
    { pattern: /global\./g, message: 'global object is not allowed' },
    { pattern: /globalThis\./g, message: 'globalThis is not allowed' },
    { pattern: /Function\s*\(/g, message: 'Function constructor is not allowed' },
    { pattern: /eval\s*\(/g, message: 'eval() is not allowed' },
    { pattern: /new\s+Function/g, message: 'new Function() is not allowed' },
    { pattern: /child_process/g, message: 'child_process is not allowed' },
    { pattern: /fs\./g, message: 'fs module is not allowed' },
    { pattern: /net\./g, message: 'net module is not allowed' },
    { pattern: /http\./g, message: 'http module is not allowed' },
    { pattern: /https\./g, message: 'https module is not allowed' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      errors.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Execute code with validation
 */
export async function executeCodeSafe<T = unknown>(
  code: string,
  items: unknown[],
  options: SandboxOptions = {}
): Promise<{
  result: T;
  logs: LogEntry[];
  executionTime: number;
}> {
  // Validate first
  const validation = validateCode(code);
  if (!validation.valid) {
    throw new SandboxError(
      `Code validation failed: ${validation.errors.join(', ')}`,
      { nodeId: options.nodeId || 'unknown', executionTime: 0, logs: [] }
    );
  }

  // Execute in sandbox
  return executeSandboxed<T>(code, items, options);
}

/**
 * Expression Parser
 *
 * Evaluates template expressions in workflow data.
 * Supports n8n-compatible syntax like:
 * - {{ $json.field }} - Access input JSON data
 * - {{ $json["field-with-dashes"] }} - Bracket notation
 * - {{ $input.all() }} - Get all input items
 * - {{ $input.first() }} - Get first input item
 * - {{ $input.last() }} - Get last input item
 * - {{ $input.item }} - Current input item
 * - {{ $node["NodeName"].json }} - Access data from specific node
 * - {{ $now }} - Current timestamp
 * - {{ $today }} - Today's date
 * - {{ $env.VAR_NAME }} - Environment variable
 * - {{ $execution.id }} - Execution ID
 * - {{ $workflow.id }} - Workflow ID
 * - {{ $workflow.name }} - Workflow name
 * - {{ Math.round($json.value) }} - JavaScript expressions
 * - {{ $json.items.map(i => i.name).join(", ") }} - Array methods
 */

import { logger } from './logger.js';

// Types
export interface ExpressionContext {
  // Current item data
  $json: Record<string, unknown>;
  // All input items
  $input: {
    all: () => ExpressionItem[];
    first: () => ExpressionItem | undefined;
    last: () => ExpressionItem | undefined;
    item: ExpressionItem;
    itemIndex: number;
  };
  // Data from other nodes
  $node: Record<string, NodeData>;
  // Execution info
  $execution: {
    id: string;
    mode: string;
    resumeUrl?: string;
  };
  // Workflow info
  $workflow: {
    id: string;
    name: string;
    active: boolean;
  };
  // Environment variables (filtered for safety)
  $env: Record<string, string>;
  // Date/time helpers
  $now: string;
  $today: string;
  // Position in loop
  $itemIndex: number;
  $runIndex: number;
  // Previous node output
  $prevNode?: NodeData;
}

export interface ExpressionItem {
  json: Record<string, unknown>;
  binary?: Record<string, unknown>;
  pairedItem?: { item: number };
}

export interface NodeData {
  json: Record<string, unknown>;
  binary?: Record<string, unknown>;
  context?: Record<string, unknown>;
  parameter?: Record<string, unknown>;
}

export interface ExpressionOptions {
  // Allow arbitrary JavaScript execution
  allowJavaScript?: boolean;
  // Timeout for expression evaluation (ms)
  timeout?: number;
  // Allowed environment variables
  allowedEnvVars?: string[];
}

// Default safe env vars
const DEFAULT_ALLOWED_ENV_VARS = [
  'NODE_ENV',
  'TZ',
  'LANG',
  'WORKFLOW_ENV',
];

/**
 * Evaluate an expression string
 */
export function evaluateExpression(
  expression: string,
  context: ExpressionContext,
  options: ExpressionOptions = {}
): unknown {
  const { allowJavaScript = true, timeout = 5000, allowedEnvVars = DEFAULT_ALLOWED_ENV_VARS } = options;

  // Filter environment variables for safety
  const safeEnv: Record<string, string> = {};
  for (const key of allowedEnvVars) {
    if (process.env[key]) {
      safeEnv[key] = process.env[key]!;
    }
  }

  // Build evaluation context
  const evalContext = {
    ...context,
    $env: safeEnv,
    // Date helpers
    $now: new Date().toISOString(),
    $today: new Date().toISOString().split('T')[0],
    // Safe built-ins
    Math,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    // Utility functions
    $if: (condition: unknown, trueVal: unknown, falseVal: unknown) =>
      condition ? trueVal : falseVal,
    $isEmpty: (value: unknown) => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    },
    $isNotEmpty: (value: unknown) => !evalContext.$isEmpty(value),
    $jmespath: jmespathEvaluate,
    $formatDate: formatDate,
    $formatNumber: formatNumber,
    $uuid: () => crypto.randomUUID(),
    $randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  };

  try {
    // Check if this is a simple property access (most common case)
    const simpleMatch = expression.match(/^\$json\.(\w+)$/);
    if (simpleMatch) {
      return context.$json[simpleMatch[1]];
    }

    // Check for bracket notation
    const bracketMatch = expression.match(/^\$json\["([^"]+)"\]$/);
    if (bracketMatch) {
      return context.$json[bracketMatch[1]];
    }

    // For more complex expressions, use Function constructor
    if (!allowJavaScript) {
      throw new Error('JavaScript expressions not allowed');
    }

    // Create a function with the context variables in scope
    const contextKeys = Object.keys(evalContext);
    const contextValues = Object.values(evalContext);

    // Wrap in try-catch for better error messages
    const code = `
      "use strict";
      try {
        return (${expression});
      } catch (e) {
        throw new Error('Expression error: ' + e.message);
      }
    `;

    const fn = new Function(...contextKeys, code);
    const result = fn(...contextValues);

    return result;
  } catch (error) {
    logger.error('Expression evaluation failed', {
      expression,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new ExpressionError(
      `Failed to evaluate expression: ${expression}`,
      expression,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Resolve all expressions in a string template
 * Finds {{ expression }} patterns and evaluates them
 */
export function resolveExpressions(
  template: string,
  context: ExpressionContext,
  options: ExpressionOptions = {}
): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  // Pattern to match {{ expression }}
  const expressionPattern = /\{\{\s*([\s\S]*?)\s*\}\}/g;

  // Check if template has any expressions
  if (!expressionPattern.test(template)) {
    return template;
  }

  // Reset regex lastIndex
  expressionPattern.lastIndex = 0;

  return template.replace(expressionPattern, (match, expression) => {
    try {
      const result = evaluateExpression(expression, context, options);

      // Convert result to string appropriately
      if (result === null || result === undefined) {
        return '';
      }
      if (typeof result === 'object') {
        return JSON.stringify(result);
      }
      return String(result);
    } catch (error) {
      logger.warn('Expression resolution failed, using original', {
        expression,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Return original match on error (or empty string based on preference)
      return match;
    }
  });
}

/**
 * Resolve expressions in any data structure (deep)
 */
export function resolveExpressionsDeep(
  data: unknown,
  context: ExpressionContext,
  options: ExpressionOptions = {}
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if the entire string is a single expression
    const singleExprMatch = data.match(/^\{\{\s*([\s\S]*?)\s*\}\}$/);
    if (singleExprMatch) {
      // Return the raw value (not stringified)
      return evaluateExpression(singleExprMatch[1], context, options);
    }
    // Otherwise resolve as template
    return resolveExpressions(data, context, options);
  }

  if (Array.isArray(data)) {
    return data.map(item => resolveExpressionsDeep(item, context, options));
  }

  if (typeof data === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Also resolve expressions in keys (rare but possible)
      const resolvedKey = resolveExpressions(key, context, options);
      resolved[resolvedKey] = resolveExpressionsDeep(value, context, options);
    }
    return resolved;
  }

  // Numbers, booleans, etc. - return as-is
  return data;
}

/**
 * Create an expression context from workflow execution data
 */
export function createExpressionContext(params: {
  inputItems: ExpressionItem[];
  itemIndex?: number;
  runIndex?: number;
  nodeOutputs?: Record<string, ExpressionItem[]>;
  executionId: string;
  executionMode: string;
  workflowId: string;
  workflowName: string;
  workflowActive?: boolean;
  previousNodeName?: string;
}): ExpressionContext {
  const {
    inputItems,
    itemIndex = 0,
    runIndex = 0,
    nodeOutputs = {},
    executionId,
    executionMode,
    workflowId,
    workflowName,
    workflowActive = true,
    previousNodeName,
  } = params;

  const currentItem = inputItems[itemIndex] || { json: {} };

  // Build $node object from node outputs
  const $node: Record<string, NodeData> = {};
  for (const [nodeName, items] of Object.entries(nodeOutputs)) {
    const firstItem = items[0];
    if (firstItem) {
      $node[nodeName] = {
        json: firstItem.json,
        binary: firstItem.binary,
      };
    }
  }

  // Get previous node data if available
  let $prevNode: NodeData | undefined;
  if (previousNodeName && nodeOutputs[previousNodeName]) {
    const prevItems = nodeOutputs[previousNodeName];
    if (prevItems[0]) {
      $prevNode = {
        json: prevItems[0].json,
        binary: prevItems[0].binary,
      };
    }
  }

  return {
    $json: currentItem.json,
    $input: {
      all: () => inputItems,
      first: () => inputItems[0],
      last: () => inputItems[inputItems.length - 1],
      item: currentItem,
      itemIndex,
    },
    $node,
    $execution: {
      id: executionId,
      mode: executionMode,
    },
    $workflow: {
      id: workflowId,
      name: workflowName,
      active: workflowActive,
    },
    $env: {},
    $now: new Date().toISOString(),
    $today: new Date().toISOString().split('T')[0],
    $itemIndex: itemIndex,
    $runIndex: runIndex,
    $prevNode,
  };
}

/**
 * Validate an expression without executing it
 */
export function validateExpression(expression: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for common syntax errors
  const openBraces = (expression.match(/\{/g) || []).length;
  const closeBraces = (expression.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push('Mismatched braces');
  }

  const openParens = (expression.match(/\(/g) || []).length;
  const closeParens = (expression.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('Mismatched parentheses');
  }

  const openBrackets = (expression.match(/\[/g) || []).length;
  const closeBrackets = (expression.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push('Mismatched brackets');
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
    { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
    { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
    { pattern: /\bimport\s*\(/, message: 'import() is not allowed' },
    { pattern: /\bprocess\./, message: 'process object is not allowed' },
    { pattern: /\bglobal\./, message: 'global object is not allowed' },
    { pattern: /\bwindow\./, message: 'window object is not allowed' },
    { pattern: /\bdocument\./, message: 'document object is not allowed' },
    { pattern: /__proto__/, message: '__proto__ is not allowed' },
    { pattern: /constructor\s*\[/, message: 'constructor access is not allowed' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(expression)) {
      errors.push(message);
    }
  }

  // Try to parse as JavaScript
  try {
    // Use Function constructor to validate syntax without executing
    new Function(`return (${expression})`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`Syntax error: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Custom error class for expression errors
 */
export class ExpressionError extends Error {
  expression: string;
  cause: string;

  constructor(message: string, expression: string, cause: string) {
    super(message);
    this.name = 'ExpressionError';
    this.expression = expression;
    this.cause = cause;
  }
}

// Helper functions

/**
 * Simple JMESPath-like path evaluation
 */
function jmespathEvaluate(data: unknown, path: string): unknown {
  if (!path || data === null || data === undefined) {
    return data;
  }

  const parts = path.split('.');
  let result = data;

  for (const part of parts) {
    if (result === null || result === undefined) {
      return undefined;
    }

    // Handle array index
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      result = (result as Record<string, unknown>)[key];
      if (Array.isArray(result)) {
        result = result[index];
      } else {
        return undefined;
      }
    } else {
      result = (result as Record<string, unknown>)[part];
    }
  }

  return result;
}

/**
 * Format a date string
 */
function formatDate(
  date: string | Date | number,
  format: string = 'YYYY-MM-DD'
): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Format a number
 */
function formatNumber(
  value: number,
  options: { decimals?: number; locale?: string } = {}
): string {
  const { decimals = 2, locale = 'en-US' } = options;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Extract all expressions from a template string
 */
export function extractExpressions(template: string): string[] {
  const expressions: string[] = [];
  const pattern = /\{\{\s*([\s\S]*?)\s*\}\}/g;
  let match;

  while ((match = pattern.exec(template)) !== null) {
    expressions.push(match[1]);
  }

  return expressions;
}

/**
 * Check if a string contains any expressions
 */
export function containsExpression(value: string): boolean {
  return /\{\{[\s\S]*?\}\}/.test(value);
}

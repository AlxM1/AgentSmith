// Expression Engine - n8n-compatible expression evaluation

import type { IDataObject, INodeExecutionData } from './types.js';

// ============================================
// Expression Context
// ============================================

export interface ExpressionContext {
  // Current item's JSON data
  $json: IDataObject;

  // Current input
  $input: {
    all: () => INodeExecutionData[];
    first: () => INodeExecutionData | undefined;
    last: () => INodeExecutionData | undefined;
    item: INodeExecutionData;
  };

  // Reference to other nodes
  $: (nodeName: string) => NodeReference;

  // Legacy node reference
  $node: Record<string, { json: IDataObject }>;

  // Execution context
  $execution: {
    id: string;
    mode: string;
    resumeUrl?: string;
  };

  // Workflow context
  $workflow: {
    id: string;
    name: string;
    active: boolean;
  };

  // Environment variables
  $env: Record<string, string>;

  // Current run index
  $runIndex: number;

  // Current item index
  $itemIndex: number;

  // Current timestamp
  $now: Date;

  // Today's date (ISO string)
  $today: string;

  // Previous node data (shorthand)
  $prevNode?: {
    name: string;
    outputIndex: number;
    runIndex: number;
  };

  // Variables
  $vars: Record<string, unknown>;

  // Secrets (from external secret store)
  $secrets?: Record<string, Record<string, string>>;
}

export interface NodeReference {
  first: () => INodeExecutionData | undefined;
  last: () => INodeExecutionData | undefined;
  all: () => INodeExecutionData[];
  item: INodeExecutionData | undefined;
  params: IDataObject;
}

// ============================================
// Expression Parser
// ============================================

const EXPRESSION_REGEX = /\{\{([\s\S]*?)\}\}/g;

/**
 * Check if a string contains expressions
 */
export function containsExpression(str: string): boolean {
  return EXPRESSION_REGEX.test(str);
}

/**
 * Extract all expressions from a string
 */
export function extractExpressions(str: string): string[] {
  const matches: string[] = [];
  let match;
  const regex = new RegExp(EXPRESSION_REGEX.source, 'g');

  while ((match = regex.exec(str)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * Create an expression context
 */
export function createExpressionContext(options: {
  inputData?: INodeExecutionData[];
  currentItem?: INodeExecutionData;
  itemIndex?: number;
  runIndex?: number;
  nodeData?: Record<string, INodeExecutionData[]>;
  workflow?: { id: string; name: string; active: boolean };
  execution?: { id: string; mode: string };
  env?: Record<string, string>;
  vars?: Record<string, unknown>;
}): ExpressionContext {
  const inputData = options.inputData || [];
  const currentItem = options.currentItem || inputData[0] || { json: {} };
  const nodeData = options.nodeData || {};

  // Create node reference function
  const $ = (nodeName: string): NodeReference => {
    const data = nodeData[nodeName] || [];
    return {
      first: () => data[0],
      last: () => data[data.length - 1],
      all: () => data,
      item: data[options.itemIndex || 0],
      params: {},
    };
  };

  // Create legacy $node object
  const $node: Record<string, { json: IDataObject }> = {};
  for (const [name, data] of Object.entries(nodeData)) {
    $node[name] = { json: data[0]?.json || {} };
  }

  return {
    $json: currentItem.json,
    $input: {
      all: () => inputData,
      first: () => inputData[0],
      last: () => inputData[inputData.length - 1],
      item: currentItem,
    },
    $,
    $node,
    $execution: options.execution || { id: '', mode: 'manual' },
    $workflow: options.workflow || { id: '', name: '', active: false },
    $env: options.env || {},
    $runIndex: options.runIndex || 0,
    $itemIndex: options.itemIndex || 0,
    $now: new Date(),
    $today: new Date().toISOString().split('T')[0],
    $vars: options.vars || {},
  };
}

/**
 * Evaluate a single expression
 */
export function evaluateExpression(
  expression: string,
  context: ExpressionContext
): unknown {
  try {
    // Build evaluation context
    const evalContext = {
      $json: context.$json,
      $input: context.$input,
      $: context.$,
      $node: context.$node,
      $execution: context.$execution,
      $workflow: context.$workflow,
      $env: context.$env,
      $runIndex: context.$runIndex,
      $itemIndex: context.$itemIndex,
      $now: context.$now,
      $today: context.$today,
      $prevNode: context.$prevNode,
      $vars: context.$vars,
      $secrets: context.$secrets,

      // Built-in functions
      $if: (condition: boolean, ifTrue: unknown, ifFalse: unknown) =>
        condition ? ifTrue : ifFalse,
      $isEmpty: (value: unknown) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && Object.keys(value as object).length === 0),
      $isNotEmpty: (value: unknown) =>
        !(
          value === null ||
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && Object.keys(value as object).length === 0)
        ),

      // DateTime helpers (basic - would use Luxon in production)
      DateTime: {
        now: () => new Date(),
        fromISO: (iso: string) => new Date(iso),
        fromMillis: (ms: number) => new Date(ms),
      },

      // JSON helper
      JSON: globalThis.JSON,

      // Math
      Math: globalThis.Math,

      // String methods
      String: globalThis.String,

      // Array methods
      Array: globalThis.Array,

      // Object methods
      Object: globalThis.Object,
    };

    // Create function with context
    const fn = new Function(
      ...Object.keys(evalContext),
      `"use strict"; return (${expression});`
    );

    return fn(...Object.values(evalContext));
  } catch (error) {
    console.error(`Expression evaluation error: ${expression}`, error);
    return undefined;
  }
}

/**
 * Resolve all expressions in a string
 */
export function resolveExpressions(
  template: string,
  context: ExpressionContext
): string {
  return template.replace(EXPRESSION_REGEX, (_, expr) => {
    const result = evaluateExpression(expr.trim(), context);
    if (result === undefined || result === null) {
      return '';
    }
    if (typeof result === 'object') {
      return JSON.stringify(result);
    }
    return String(result);
  });
}

/**
 * Resolve expressions in an object recursively
 */
export function resolveExpressionsInObject<T>(
  obj: T,
  context: ExpressionContext
): T {
  if (typeof obj === 'string') {
    if (containsExpression(obj)) {
      // If the entire string is one expression, return the raw value
      const trimmed = obj.trim();
      if (trimmed.startsWith('={{') && trimmed.endsWith('}}')) {
        const expr = trimmed.slice(3, -2).trim();
        return evaluateExpression(expr, context) as T;
      }
      // Otherwise resolve as string template
      return resolveExpressions(obj, context) as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveExpressionsInObject(item, context)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveExpressionsInObject(value, context);
    }
    return result as T;
  }

  return obj;
}

/**
 * Get a value from an object using dot notation path
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in an object using dot notation path
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

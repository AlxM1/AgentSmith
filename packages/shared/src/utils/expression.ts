// Expression Evaluation Utilities

/**
 * Check if a string contains an expression ({{ }})
 */
export function containsExpression(str: string): boolean {
  return /\{\{.+?\}\}/g.test(str);
}

/**
 * Extract all expressions from a string
 */
export function extractExpressions(str: string): string[] {
  const matches = str.match(/\{\{(.+?)\}\}/g);
  return matches ? matches.map(m => m.slice(2, -2).trim()) : [];
}

/**
 * Resolve a property path from an object (e.g., "data.items[0].name")
 */
export function resolvePath(obj: unknown, path: string): unknown {
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
 * Set a value at a property path in an object
 */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
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

/**
 * Simple expression evaluator context
 */
export interface IExpressionContext {
  $json: Record<string, unknown>;
  $input: {
    all: () => Array<{ json: Record<string, unknown> }>;
    first: () => { json: Record<string, unknown> } | null;
    last: () => { json: Record<string, unknown> } | null;
    item: { json: Record<string, unknown> };
  };
  $node: Record<string, unknown>;
  $workflow: Record<string, unknown>;
  $env: Record<string, string>;
  $now: Date;
  $today: string;
  $runIndex: number;
  $itemIndex: number;
}

/**
 * Create an expression context
 */
export function createExpressionContext(options: {
  inputData?: Array<{ json: Record<string, unknown> }>;
  currentItem?: { json: Record<string, unknown> };
  nodeData?: Record<string, unknown>;
  workflowData?: Record<string, unknown>;
  env?: Record<string, string>;
  runIndex?: number;
  itemIndex?: number;
}): IExpressionContext {
  const inputData = options.inputData || [];
  const currentItem = options.currentItem || { json: {} };

  return {
    $json: currentItem.json,
    $input: {
      all: () => inputData,
      first: () => inputData[0] || null,
      last: () => inputData[inputData.length - 1] || null,
      item: currentItem,
    },
    $node: options.nodeData || {},
    $workflow: options.workflowData || {},
    $env: options.env || {},
    $now: new Date(),
    $today: new Date().toISOString().split('T')[0],
    $runIndex: options.runIndex || 0,
    $itemIndex: options.itemIndex || 0,
  };
}

/**
 * Evaluate a simple expression (UNSAFE - use sandboxed evaluation in production)
 */
export function evaluateExpression(
  expression: string,
  context: IExpressionContext
): unknown {
  // This is a simplified implementation
  // In production, use a proper sandboxed evaluator

  // Handle simple property access
  if (expression.startsWith('$json.')) {
    return resolvePath(context.$json, expression.slice(6));
  }

  if (expression.startsWith('$env.')) {
    return context.$env[expression.slice(5)];
  }

  if (expression === '$now') {
    return context.$now;
  }

  if (expression === '$today') {
    return context.$today;
  }

  if (expression === '$runIndex') {
    return context.$runIndex;
  }

  if (expression === '$itemIndex') {
    return context.$itemIndex;
  }

  // For more complex expressions, return the expression itself
  // A production implementation would use a proper parser/evaluator
  return expression;
}

/**
 * Resolve all expressions in a string
 */
export function resolveExpressions(
  template: string,
  context: IExpressionContext
): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
    const result = evaluateExpression(expr.trim(), context);
    return String(result ?? '');
  });
}

/**
 * Resolve expressions in an object (recursively)
 */
export function resolveExpressionsInObject(
  obj: unknown,
  context: IExpressionContext
): unknown {
  if (typeof obj === 'string') {
    if (containsExpression(obj)) {
      return resolveExpressions(obj, context);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveExpressionsInObject(item, context));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveExpressionsInObject(value, context);
    }
    return result;
  }

  return obj;
}

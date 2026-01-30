/**
 * Flow Control Nodes
 *
 * Nodes for controlling workflow execution flow:
 * - Split in Batches
 * - Loop
 * - Merge
 * - Switch/Router
 * - Filter
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../sdk/types.js';

// ============================================================================
// SPLIT IN BATCHES NODE
// ============================================================================

export const splitInBatchesNode: NodeDefinition = {
  name: 'Split In Batches',
  type: 'split-in-batches',
  group: 'Flow',
  version: 1,
  description: 'Split items into smaller batches for processing',
  icon: 'layers',
  color: '#8B5CF6',

  defaults: {
    name: 'Split In Batches',
  },

  inputs: ['main'],
  outputs: ['main', 'done'],
  outputNames: ['Batch', 'Done'],

  properties: [
    {
      name: 'batchSize',
      displayName: 'Batch Size',
      type: 'number',
      default: 10,
      required: true,
      typeOptions: {
        minValue: 1,
      },
      description: 'Number of items per batch',
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'reset',
          displayName: 'Reset',
          type: 'boolean',
          default: false,
          description: 'Reset batch counter when workflow restarts',
        },
        {
          name: 'loop',
          displayName: 'Loop Back',
          type: 'boolean',
          default: true,
          description: 'Send batch output back to this node for next batch',
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const batchSize = context.getNodeParameter('batchSize', 0) as number;
    const options = context.getNodeParameter('options', 0) as any;

    // Get or initialize batch state
    const state = (context as any).getState?.() || { currentIndex: 0 };
    let currentIndex = options.reset ? 0 : state.currentIndex;

    // Calculate batch
    const startIndex = currentIndex;
    const endIndex = Math.min(startIndex + batchSize, items.length);
    const batch = items.slice(startIndex, endIndex);
    const isLastBatch = endIndex >= items.length;

    // Update state
    (context as any).setState?.({ currentIndex: isLastBatch ? 0 : endIndex });

    // Add batch metadata
    const batchItems = batch.map((item, i) => ({
      json: {
        ...item.json,
        _batch: {
          index: startIndex + i,
          batchNumber: Math.floor(startIndex / batchSize) + 1,
          batchSize,
          totalItems: items.length,
          isFirst: startIndex === 0,
          isLast: isLastBatch,
        },
      },
    }));

    if (isLastBatch) {
      // Send to "Done" output
      return [[], batchItems];
    } else {
      // Send to "Batch" output (will loop back if configured)
      return [batchItems, []];
    }
  },
};

// ============================================================================
// LOOP NODE
// ============================================================================

export const loopNode: NodeDefinition = {
  name: 'Loop',
  type: 'loop',
  group: 'Flow',
  version: 1,
  description: 'Loop over items with explicit control',
  icon: 'repeat',
  color: '#6366F1',

  defaults: {
    name: 'Loop',
  },

  inputs: ['main'],
  outputs: ['main', 'loop', 'done'],
  outputNames: ['Item', 'Loop Back', 'Done'],

  properties: [
    {
      name: 'mode',
      displayName: 'Loop Mode',
      type: 'options',
      options: [
        { name: 'Each Item', value: 'each' },
        { name: 'Fixed Count', value: 'count' },
        { name: 'While Condition', value: 'while' },
      ],
      default: 'each',
    },
    {
      name: 'loopCount',
      displayName: 'Loop Count',
      type: 'number',
      default: 10,
      displayOptions: {
        show: {
          mode: ['count'],
        },
      },
    },
    {
      name: 'condition',
      displayName: 'Continue While',
      type: 'string',
      default: '={{ $json.continue === true }}',
      displayOptions: {
        show: {
          mode: ['while'],
        },
      },
      description: 'Expression that returns true to continue looping',
    },
    {
      name: 'maxIterations',
      displayName: 'Max Iterations',
      type: 'number',
      default: 1000,
      description: 'Safety limit to prevent infinite loops',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const mode = context.getNodeParameter('mode', 0) as string;
    const maxIterations = context.getNodeParameter('maxIterations', 0) as number;

    // Get or initialize loop state
    const state = (context as any).getState?.() || { iteration: 0, itemIndex: 0 };
    let { iteration, itemIndex } = state;

    // Check max iterations
    if (iteration >= maxIterations) {
      console.warn('Loop reached max iterations limit');
      return [[], [], items]; // Send all to "Done"
    }

    let shouldContinue = false;
    let currentItem: any = null;

    switch (mode) {
      case 'each': {
        if (itemIndex < items.length) {
          currentItem = items[itemIndex];
          itemIndex++;
          shouldContinue = itemIndex < items.length;
        }
        break;
      }
      case 'count': {
        const loopCount = context.getNodeParameter('loopCount', 0) as number;
        if (iteration < loopCount) {
          currentItem = items[0] || { json: {} };
          iteration++;
          shouldContinue = iteration < loopCount;
        }
        break;
      }
      case 'while': {
        const condition = context.getNodeParameter('condition', 0) as boolean;
        if (condition && iteration < maxIterations) {
          currentItem = items[0] || { json: {} };
          iteration++;
          shouldContinue = true; // Will be re-evaluated on next iteration
        }
        break;
      }
    }

    // Update state
    (context as any).setState?.({ iteration, itemIndex });

    if (!currentItem) {
      // No more items, send to "Done"
      return [[], [], items];
    }

    // Add loop metadata
    const outputItem = {
      json: {
        ...currentItem.json,
        _loop: {
          iteration,
          itemIndex: mode === 'each' ? itemIndex - 1 : 0,
          totalItems: items.length,
          isFirst: iteration === 1 || itemIndex === 1,
          isLast: !shouldContinue,
        },
      },
    };

    if (shouldContinue) {
      // Send current item and loop back signal
      return [[outputItem], [outputItem], []];
    } else {
      // Send current item and done signal
      return [[outputItem], [], [outputItem]];
    }
  },
};

// ============================================================================
// MERGE NODE
// ============================================================================

export const mergeNode: NodeDefinition = {
  name: 'Merge',
  type: 'merge',
  group: 'Flow',
  version: 1,
  description: 'Merge data from multiple branches',
  icon: 'git-merge',
  color: '#10B981',

  defaults: {
    name: 'Merge',
  },

  inputs: ['main', 'main'],
  inputNames: ['Input 1', 'Input 2'],
  outputs: ['main'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Append', value: 'append' },
        { name: 'Merge By Position', value: 'mergeByPosition' },
        { name: 'Merge By Key', value: 'mergeByKey' },
        { name: 'Keep Key Matches', value: 'keepMatches' },
        { name: 'Remove Key Matches', value: 'removeMatches' },
        { name: 'Wait', value: 'wait' },
        { name: 'Combine', value: 'combine' },
      ],
      default: 'append',
    },
    {
      name: 'mergeKey',
      displayName: 'Merge Key',
      type: 'string',
      default: 'id',
      displayOptions: {
        show: {
          mode: ['mergeByKey', 'keepMatches', 'removeMatches'],
        },
      },
      description: 'Property to match items on',
    },
    {
      name: 'clashHandling',
      displayName: 'Clash Handling',
      type: 'options',
      options: [
        { name: 'Use Input 1', value: 'preferInput1' },
        { name: 'Use Input 2', value: 'preferInput2' },
        { name: 'Merge', value: 'merge' },
      ],
      default: 'merge',
      displayOptions: {
        show: {
          mode: ['mergeByKey', 'mergeByPosition'],
        },
      },
    },
    {
      name: 'includeUnpaired',
      displayName: 'Include Unpaired Items',
      type: 'boolean',
      default: true,
      displayOptions: {
        show: {
          mode: ['mergeByKey'],
        },
      },
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const input1 = context.getInputData(0) || [];
    const input2 = context.getInputData(1) || [];
    const mode = context.getNodeParameter('mode', 0) as string;

    let results: any[] = [];

    switch (mode) {
      case 'append': {
        // Simply concatenate all items
        results = [...input1, ...input2];
        break;
      }

      case 'mergeByPosition': {
        // Merge items at same index
        const clashHandling = context.getNodeParameter('clashHandling', 0) as string;
        const maxLength = Math.max(input1.length, input2.length);

        for (let i = 0; i < maxLength; i++) {
          const item1 = input1[i]?.json || {};
          const item2 = input2[i]?.json || {};

          let merged: any;
          if (clashHandling === 'preferInput1') {
            merged = { ...item2, ...item1 };
          } else if (clashHandling === 'preferInput2') {
            merged = { ...item1, ...item2 };
          } else {
            merged = deepMerge(item1, item2);
          }

          results.push({ json: merged });
        }
        break;
      }

      case 'mergeByKey': {
        const mergeKey = context.getNodeParameter('mergeKey', 0) as string;
        const clashHandling = context.getNodeParameter('clashHandling', 0) as string;
        const includeUnpaired = context.getNodeParameter('includeUnpaired', 0) as boolean;

        // Build map from input2
        const input2Map = new Map<string, any>();
        for (const item of input2) {
          const key = item.json[mergeKey];
          if (key !== undefined) {
            input2Map.set(String(key), item.json);
          }
        }

        // Merge with input1
        const matched = new Set<string>();
        for (const item of input1) {
          const key = String(item.json[mergeKey]);
          const item2 = input2Map.get(key);

          if (item2) {
            matched.add(key);
            let merged: any;
            if (clashHandling === 'preferInput1') {
              merged = { ...item2, ...item.json };
            } else if (clashHandling === 'preferInput2') {
              merged = { ...item.json, ...item2 };
            } else {
              merged = deepMerge(item.json, item2);
            }
            results.push({ json: merged });
          } else if (includeUnpaired) {
            results.push({ json: item.json });
          }
        }

        // Add unmatched from input2
        if (includeUnpaired) {
          for (const item of input2) {
            const key = String(item.json[mergeKey]);
            if (!matched.has(key)) {
              results.push({ json: item.json });
            }
          }
        }
        break;
      }

      case 'keepMatches': {
        const mergeKey = context.getNodeParameter('mergeKey', 0) as string;
        const input2Keys = new Set(input2.map((i) => String(i.json[mergeKey])));

        results = input1.filter((item) => input2Keys.has(String(item.json[mergeKey])));
        break;
      }

      case 'removeMatches': {
        const mergeKey = context.getNodeParameter('mergeKey', 0) as string;
        const input2Keys = new Set(input2.map((i) => String(i.json[mergeKey])));

        results = input1.filter((item) => !input2Keys.has(String(item.json[mergeKey])));
        break;
      }

      case 'wait': {
        // Wait for both inputs, then output both
        results = [...input1, ...input2];
        break;
      }

      case 'combine': {
        // Combine all items into a single object
        results = [
          {
            json: {
              input1: input1.map((i) => i.json),
              input2: input2.map((i) => i.json),
              count: {
                input1: input1.length,
                input2: input2.length,
                total: input1.length + input2.length,
              },
            },
          },
        ];
        break;
      }
    }

    return [results];
  },
};

// ============================================================================
// SWITCH NODE
// ============================================================================

export const switchNode: NodeDefinition = {
  name: 'Switch',
  type: 'switch',
  group: 'Flow',
  version: 1,
  description: 'Route items to different outputs based on conditions',
  icon: 'git-branch',
  color: '#F59E0B',

  defaults: {
    name: 'Switch',
  },

  inputs: ['main'],
  outputs: ['main', 'main', 'main', 'main'],
  outputNames: ['Output 0', 'Output 1', 'Output 2', 'Fallback'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Rules', value: 'rules' },
        { name: 'Expression', value: 'expression' },
      ],
      default: 'rules',
    },
    {
      name: 'rules',
      displayName: 'Routing Rules',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      displayOptions: {
        show: {
          mode: ['rules'],
        },
      },
      default: {},
      options: [
        {
          name: 'rule',
          displayName: 'Rule',
          values: [
            {
              name: 'output',
              displayName: 'Output',
              type: 'number',
              default: 0,
              typeOptions: {
                minValue: 0,
                maxValue: 3,
              },
            },
            {
              name: 'condition',
              displayName: 'Condition',
              type: 'filter',
              default: {},
            },
          ],
        },
      ],
    },
    {
      name: 'expression',
      displayName: 'Output Expression',
      type: 'string',
      default: '={{ $json.type === "a" ? 0 : 1 }}',
      displayOptions: {
        show: {
          mode: ['expression'],
        },
      },
      description: 'Expression that returns output index (0-3)',
    },
    {
      name: 'fallbackOutput',
      displayName: 'Fallback Output',
      type: 'number',
      default: 3,
      typeOptions: {
        minValue: 0,
        maxValue: 3,
      },
      description: 'Output to use when no rules match',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const mode = context.getNodeParameter('mode', 0) as string;
    const fallbackOutput = context.getNodeParameter('fallbackOutput', 0) as number;

    const outputs: any[][] = [[], [], [], []];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let outputIndex = fallbackOutput;

      if (mode === 'expression') {
        const result = context.getNodeParameter('expression', i) as number;
        outputIndex = Math.min(Math.max(0, result), 3);
      } else {
        const rules = context.getNodeParameter('rules', i) as any;
        // Evaluate rules (simplified - would need filter evaluation)
        if (rules?.rule) {
          for (const rule of rules.rule) {
            // Rule evaluation would go here
            // For now, use first rule's output
            outputIndex = rule.output;
            break;
          }
        }
      }

      outputs[outputIndex].push(item);
    }

    return outputs;
  },
};

// ============================================================================
// FILTER NODE
// ============================================================================

export const filterNode: NodeDefinition = {
  name: 'Filter',
  type: 'filter',
  group: 'Flow',
  version: 1,
  description: 'Filter items based on conditions',
  icon: 'filter',
  color: '#3B82F6',

  defaults: {
    name: 'Filter',
  },

  inputs: ['main'],
  outputs: ['main', 'main'],
  outputNames: ['Kept', 'Discarded'],

  properties: [
    {
      name: 'conditions',
      displayName: 'Conditions',
      type: 'filter',
      default: {},
      description: 'Conditions to filter items',
    },
    {
      name: 'combineConditions',
      displayName: 'Combine Conditions',
      type: 'options',
      options: [
        { name: 'AND (all must match)', value: 'and' },
        { name: 'OR (any must match)', value: 'or' },
      ],
      default: 'and',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const items = context.getInputData();
    const combineConditions = context.getNodeParameter('combineConditions', 0) as string;

    const kept: any[] = [];
    const discarded: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const conditions = context.getNodeParameter('conditions', i) as any;

      // Simplified condition evaluation
      // In real implementation, would evaluate filter conditions
      const passes = evaluateConditions(items[i].json, conditions, combineConditions);

      if (passes) {
        kept.push(items[i]);
      } else {
        discarded.push(items[i]);
      }
    }

    return [kept, discarded];
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

function evaluateConditions(data: any, conditions: any, combine: string): boolean {
  if (!conditions || !conditions.conditions || conditions.conditions.length === 0) {
    return true; // No conditions = pass all
  }

  const results = conditions.conditions.map((condition: any) => {
    const { leftValue, operator, rightValue } = condition;
    const left = getNestedValue(data, leftValue);
    const right = rightValue;

    switch (operator) {
      case 'equals':
        return left === right;
      case 'notEquals':
        return left !== right;
      case 'contains':
        return String(left).includes(String(right));
      case 'notContains':
        return !String(left).includes(String(right));
      case 'startsWith':
        return String(left).startsWith(String(right));
      case 'endsWith':
        return String(left).endsWith(String(right));
      case 'greaterThan':
        return Number(left) > Number(right);
      case 'lessThan':
        return Number(left) < Number(right);
      case 'isEmpty':
        return !left || left === '' || (Array.isArray(left) && left.length === 0);
      case 'isNotEmpty':
        return !!left && left !== '' && (!Array.isArray(left) || left.length > 0);
      default:
        return true;
    }
  });

  return combine === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export default {
  splitInBatchesNode,
  loopNode,
  mergeNode,
  switchNode,
  filterNode,
};

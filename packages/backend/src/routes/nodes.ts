// Node Type Routes

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { INodeTypeDescription, NodeCategory } from '@agentsmith/shared';

const router = Router();

router.use(authenticate);

// Get all node types
router.get('/', async (_req, res, next) => {
  try {
    // In a full implementation, this would load node types from registered node packages
    const nodeTypes = getCoreNodeTypes();

    res.json({
      success: true,
      data: nodeTypes,
    });
  } catch (error) {
    next(error);
  }
});

// Get node types by category
router.get('/categories', async (_req, res, next) => {
  try {
    const nodeTypes = getCoreNodeTypes();

    const categories: Record<string, INodeTypeDescription[]> = {};

    for (const node of nodeTypes) {
      if (!categories[node.category]) {
        categories[node.category] = [];
      }
      categories[node.category].push(node);
    }

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// Get single node type
router.get('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;

    const nodeTypes = getCoreNodeTypes();
    const nodeType = nodeTypes.find(n => n.name === name);

    if (!nodeType) {
      return res.status(404).json({
        success: false,
        error: { message: 'Node type not found' },
      });
    }

    res.json({
      success: true,
      data: nodeType,
    });
  } catch (error) {
    next(error);
  }
});

// Search node types
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json({
        success: true,
        data: [],
      });
    }

    const query = q.toLowerCase();
    const nodeTypes = getCoreNodeTypes();

    const results = nodeTypes.filter(n =>
      n.displayName.toLowerCase().includes(query) ||
      n.description.toLowerCase().includes(query) ||
      n.name.toLowerCase().includes(query)
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

// Core node type definitions
function getCoreNodeTypes(): INodeTypeDescription[] {
  return [
    // Triggers
    {
      name: 'agentsmith.manualTrigger',
      displayName: 'Manual Trigger',
      description: 'Starts the workflow manually',
      icon: 'play',
      iconColor: '#22c55e',
      group: ['trigger'],
      version: 1,
      defaults: { name: 'Manual Trigger' },
      inputs: [],
      outputs: [{ type: 'main' }],
      properties: [],
      category: 'trigger' as NodeCategory,
    },
    {
      name: 'agentsmith.webhookTrigger',
      displayName: 'Webhook',
      description: 'Starts the workflow when a webhook is called',
      icon: 'webhook',
      iconColor: '#3b82f6',
      group: ['trigger'],
      version: 1,
      defaults: { name: 'Webhook' },
      inputs: [],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'httpMethod',
          displayName: 'HTTP Method',
          type: 'options',
          default: 'POST',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'DELETE', value: 'DELETE' },
          ],
        },
        {
          name: 'path',
          displayName: 'Path',
          type: 'string',
          default: '/webhook',
          description: 'The webhook URL path',
        },
      ],
      category: 'trigger' as NodeCategory,
    },
    {
      name: 'agentsmith.scheduleTrigger',
      displayName: 'Schedule Trigger',
      description: 'Starts the workflow on a schedule',
      icon: 'clock',
      iconColor: '#8b5cf6',
      group: ['trigger'],
      version: 1,
      defaults: { name: 'Schedule' },
      inputs: [],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'rule',
          displayName: 'Trigger Rule',
          type: 'options',
          default: 'interval',
          options: [
            { name: 'Interval', value: 'interval' },
            { name: 'Cron', value: 'cron' },
          ],
        },
        {
          name: 'interval',
          displayName: 'Interval (minutes)',
          type: 'number',
          default: 60,
          displayOptions: {
            show: { rule: ['interval'] },
          },
        },
        {
          name: 'cronExpression',
          displayName: 'Cron Expression',
          type: 'string',
          default: '0 * * * *',
          displayOptions: {
            show: { rule: ['cron'] },
          },
        },
      ],
      category: 'trigger' as NodeCategory,
    },

    // Flow Control
    {
      name: 'agentsmith.if',
      displayName: 'IF',
      description: 'Route items based on conditions',
      icon: 'git-branch',
      iconColor: '#f59e0b',
      group: ['flow'],
      version: 1,
      defaults: { name: 'IF' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main', displayName: 'True' }, { type: 'main', displayName: 'False' }],
      properties: [
        {
          name: 'conditions',
          displayName: 'Conditions',
          type: 'collection',
          default: {},
        },
      ],
      category: 'flow' as NodeCategory,
    },
    {
      name: 'agentsmith.switch',
      displayName: 'Switch',
      description: 'Route items based on multiple conditions',
      icon: 'shuffle',
      iconColor: '#f59e0b',
      group: ['flow'],
      version: 1,
      defaults: { name: 'Switch' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }, { type: 'main' }, { type: 'main' }, { type: 'main' }],
      properties: [
        {
          name: 'mode',
          displayName: 'Mode',
          type: 'options',
          default: 'rules',
          options: [
            { name: 'Rules', value: 'rules' },
            { name: 'Expression', value: 'expression' },
          ],
        },
      ],
      category: 'flow' as NodeCategory,
    },
    {
      name: 'agentsmith.merge',
      displayName: 'Merge',
      description: 'Merge multiple inputs into one',
      icon: 'git-merge',
      iconColor: '#f59e0b',
      group: ['flow'],
      version: 1,
      defaults: { name: 'Merge' },
      inputs: [{ type: 'main' }, { type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'mode',
          displayName: 'Mode',
          type: 'options',
          default: 'append',
          options: [
            { name: 'Append', value: 'append' },
            { name: 'Combine', value: 'combine' },
            { name: 'Choose Branch', value: 'chooseBranch' },
          ],
        },
      ],
      category: 'flow' as NodeCategory,
    },
    {
      name: 'agentsmith.loop',
      displayName: 'Loop Over Items',
      description: 'Process items one by one in a loop',
      icon: 'repeat',
      iconColor: '#f59e0b',
      group: ['flow'],
      version: 1,
      defaults: { name: 'Loop' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main', displayName: 'Loop' }, { type: 'main', displayName: 'Done' }],
      properties: [],
      category: 'flow' as NodeCategory,
    },

    // Transform
    {
      name: 'agentsmith.set',
      displayName: 'Set',
      description: 'Set values on items',
      icon: 'edit',
      iconColor: '#10b981',
      group: ['transform'],
      version: 1,
      defaults: { name: 'Set' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'mode',
          displayName: 'Mode',
          type: 'options',
          default: 'manual',
          options: [
            { name: 'Manual', value: 'manual' },
            { name: 'JSON', value: 'json' },
          ],
        },
        {
          name: 'values',
          displayName: 'Values',
          type: 'fixedCollection',
          default: {},
        },
      ],
      category: 'transform' as NodeCategory,
    },
    {
      name: 'agentsmith.code',
      displayName: 'Code',
      description: 'Execute custom JavaScript code',
      icon: 'code',
      iconColor: '#10b981',
      group: ['transform'],
      version: 1,
      defaults: { name: 'Code' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'mode',
          displayName: 'Mode',
          type: 'options',
          default: 'runOnceForAllItems',
          options: [
            { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
            { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
          ],
        },
        {
          name: 'jsCode',
          displayName: 'JavaScript',
          type: 'string',
          default: '// Write your code here\nreturn items;',
          typeOptions: { rows: 10 },
        },
      ],
      category: 'transform' as NodeCategory,
    },

    // Actions
    {
      name: 'agentsmith.httpRequest',
      displayName: 'HTTP Request',
      description: 'Make HTTP requests to any API',
      icon: 'globe',
      iconColor: '#6366f1',
      group: ['action'],
      version: 1,
      defaults: { name: 'HTTP Request' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'method',
          displayName: 'Method',
          type: 'options',
          default: 'GET',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'PATCH', value: 'PATCH' },
            { name: 'DELETE', value: 'DELETE' },
          ],
        },
        {
          name: 'url',
          displayName: 'URL',
          type: 'string',
          default: '',
          required: true,
        },
        {
          name: 'authentication',
          displayName: 'Authentication',
          type: 'options',
          default: 'none',
          options: [
            { name: 'None', value: 'none' },
            { name: 'Predefined Credential', value: 'predefinedCredential' },
            { name: 'Generic Credential', value: 'genericCredential' },
          ],
        },
      ],
      category: 'action' as NodeCategory,
    },

    // AI
    {
      name: 'agentsmith.aiAgent',
      displayName: 'AI Agent',
      description: 'Create an AI agent with tools',
      icon: 'bot',
      iconColor: '#ec4899',
      group: ['ai'],
      version: 1,
      defaults: { name: 'AI Agent' },
      inputs: [{ type: 'main' }, { type: 'ai_memory' }, { type: 'ai_tool' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'model',
          displayName: 'Model',
          type: 'options',
          default: 'gpt-4',
          options: [
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            { name: 'Claude 3 Opus', value: 'claude-3-opus' },
            { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
          ],
        },
        {
          name: 'systemPrompt',
          displayName: 'System Prompt',
          type: 'string',
          default: 'You are a helpful assistant.',
          typeOptions: { rows: 5 },
        },
      ],
      credentials: [{ name: 'openAiApi' }, { name: 'anthropicApi' }],
      category: 'ai' as NodeCategory,
    },
    {
      name: 'agentsmith.aiChain',
      displayName: 'AI Chain',
      description: 'Run a chain of AI prompts',
      icon: 'link',
      iconColor: '#ec4899',
      group: ['ai'],
      version: 1,
      defaults: { name: 'AI Chain' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'model',
          displayName: 'Model',
          type: 'options',
          default: 'gpt-3.5-turbo',
          options: [
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
          ],
        },
        {
          name: 'prompt',
          displayName: 'Prompt',
          type: 'string',
          default: '',
          typeOptions: { rows: 5 },
        },
      ],
      category: 'ai' as NodeCategory,
    },

    // Utility
    {
      name: 'agentsmith.wait',
      displayName: 'Wait',
      description: 'Wait for a specified time',
      icon: 'clock',
      iconColor: '#64748b',
      group: ['utility'],
      version: 1,
      defaults: { name: 'Wait' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [
        {
          name: 'amount',
          displayName: 'Amount',
          type: 'number',
          default: 1,
        },
        {
          name: 'unit',
          displayName: 'Unit',
          type: 'options',
          default: 'seconds',
          options: [
            { name: 'Seconds', value: 'seconds' },
            { name: 'Minutes', value: 'minutes' },
            { name: 'Hours', value: 'hours' },
          ],
        },
      ],
      category: 'utility' as NodeCategory,
    },
    {
      name: 'agentsmith.noOp',
      displayName: 'No Operation',
      description: 'Do nothing (useful for organizing workflows)',
      icon: 'minus',
      iconColor: '#64748b',
      group: ['utility'],
      version: 1,
      defaults: { name: 'No Op' },
      inputs: [{ type: 'main' }],
      outputs: [{ type: 'main' }],
      properties: [],
      category: 'utility' as NodeCategory,
    },
  ];
}

export { router as nodeRouter };

// Workflow Templates Library
// Pre-built workflow examples to help users get started

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    position: { x: number; y: number };
    parameters: Record<string, unknown>;
  }>;
  connections: Array<{
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }>;
}

export const workflowTemplates: WorkflowTemplate[] = [
  // ============================================
  // Data Processing Templates
  // ============================================
  {
    id: 'template_data_transform',
    name: 'Data Transform Pipeline',
    description: 'Transform and filter data from a webhook, process it, and send results via HTTP.',
    category: 'Data Processing',
    tags: ['data', 'transform', 'webhook', 'http'],
    difficulty: 'beginner',
    nodes: [
      {
        id: 'webhook_1',
        type: 'n8n-nodes-base.webhook',
        name: 'Receive Data',
        position: { x: 100, y: 200 },
        parameters: {
          path: 'data-pipeline',
          httpMethod: 'POST'
        }
      },
      {
        id: 'set_1',
        type: 'n8n-nodes-base.set',
        name: 'Transform Data',
        position: { x: 300, y: 200 },
        parameters: {
          values: {
            string: [
              { name: 'processedAt', value: '={{new Date().toISOString()}}' }
            ]
          }
        }
      },
      {
        id: 'filter_1',
        type: 'n8n-nodes-base.filter',
        name: 'Filter Valid Items',
        position: { x: 500, y: 200 },
        parameters: {
          conditions: {
            string: [
              { value1: '={{$json.status}}', operation: 'equals', value2: 'active' }
            ]
          }
        }
      },
      {
        id: 'http_1',
        type: 'n8n-nodes-base.httpRequest',
        name: 'Send Results',
        position: { x: 700, y: 200 },
        parameters: {
          url: 'https://api.example.com/results',
          method: 'POST',
          bodyParametersJson: '={{ $json }}'
        }
      }
    ],
    connections: [
      { source: 'webhook_1', sourceHandle: 'main', target: 'set_1', targetHandle: 'main' },
      { source: 'set_1', sourceHandle: 'main', target: 'filter_1', targetHandle: 'main' },
      { source: 'filter_1', sourceHandle: 'main', target: 'http_1', targetHandle: 'main' }
    ]
  },

  {
    id: 'template_csv_processor',
    name: 'CSV File Processor',
    description: 'Read a CSV file, process each row, and output results.',
    category: 'Data Processing',
    tags: ['csv', 'file', 'batch', 'processing'],
    difficulty: 'beginner',
    nodes: [
      {
        id: 'trigger_1',
        type: 'n8n-nodes-base.manualTrigger',
        name: 'Start',
        position: { x: 100, y: 200 },
        parameters: {}
      },
      {
        id: 'read_csv_1',
        type: 'n8n-nodes-base.spreadsheetFile',
        name: 'Read CSV',
        position: { x: 300, y: 200 },
        parameters: {
          operation: 'fromFile',
          fileFormat: 'csv'
        }
      },
      {
        id: 'split_1',
        type: 'n8n-nodes-base.splitInBatches',
        name: 'Process in Batches',
        position: { x: 500, y: 200 },
        parameters: {
          batchSize: 10
        }
      },
      {
        id: 'code_1',
        type: 'n8n-nodes-base.code',
        name: 'Process Row',
        position: { x: 700, y: 200 },
        parameters: {
          jsCode: `
// Process each item
for (const item of $input.all()) {
  item.json.processed = true;
  item.json.timestamp = new Date().toISOString();
}
return $input.all();
`
        }
      }
    ],
    connections: [
      { source: 'trigger_1', sourceHandle: 'main', target: 'read_csv_1', targetHandle: 'main' },
      { source: 'read_csv_1', sourceHandle: 'main', target: 'split_1', targetHandle: 'main' },
      { source: 'split_1', sourceHandle: 'main', target: 'code_1', targetHandle: 'main' }
    ]
  },

  // ============================================
  // Integration Templates
  // ============================================
  {
    id: 'template_slack_notification',
    name: 'Slack Notification Bot',
    description: 'Receive webhook events and send notifications to Slack channels.',
    category: 'Integrations',
    tags: ['slack', 'notification', 'webhook', 'alerts'],
    difficulty: 'beginner',
    nodes: [
      {
        id: 'webhook_1',
        type: 'n8n-nodes-base.webhook',
        name: 'Receive Event',
        position: { x: 100, y: 200 },
        parameters: {
          path: 'slack-notify',
          httpMethod: 'POST'
        }
      },
      {
        id: 'switch_1',
        type: 'n8n-nodes-base.switch',
        name: 'Route by Type',
        position: { x: 300, y: 200 },
        parameters: {
          dataPropertyName: 'eventType',
          rules: {
            rules: [
              { value: 'error', output: 0 },
              { value: 'warning', output: 1 },
              { value: 'info', output: 2 }
            ]
          }
        }
      },
      {
        id: 'slack_error',
        type: 'n8n-nodes-base.slack',
        name: 'Send Error Alert',
        position: { x: 500, y: 100 },
        parameters: {
          channel: '#alerts-critical',
          text: ':rotating_light: *Error Alert*\n{{$json.message}}'
        }
      },
      {
        id: 'slack_warning',
        type: 'n8n-nodes-base.slack',
        name: 'Send Warning',
        position: { x: 500, y: 200 },
        parameters: {
          channel: '#alerts-warnings',
          text: ':warning: *Warning*\n{{$json.message}}'
        }
      },
      {
        id: 'slack_info',
        type: 'n8n-nodes-base.slack',
        name: 'Send Info',
        position: { x: 500, y: 300 },
        parameters: {
          channel: '#notifications',
          text: ':information_source: {{$json.message}}'
        }
      }
    ],
    connections: [
      { source: 'webhook_1', sourceHandle: 'main', target: 'switch_1', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '0', target: 'slack_error', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '1', target: 'slack_warning', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '2', target: 'slack_info', targetHandle: 'main' }
    ]
  },

  {
    id: 'template_github_pr_notifier',
    name: 'GitHub PR Notifier',
    description: 'Monitor GitHub pull requests and send notifications on updates.',
    category: 'Integrations',
    tags: ['github', 'pr', 'notification', 'devops'],
    difficulty: 'intermediate',
    nodes: [
      {
        id: 'webhook_1',
        type: 'n8n-nodes-base.webhook',
        name: 'GitHub Webhook',
        position: { x: 100, y: 200 },
        parameters: {
          path: 'github-pr',
          httpMethod: 'POST'
        }
      },
      {
        id: 'if_1',
        type: 'n8n-nodes-base.if',
        name: 'Is PR Event?',
        position: { x: 300, y: 200 },
        parameters: {
          conditions: {
            string: [
              { value1: '={{$json.headers["x-github-event"]}}', operation: 'equals', value2: 'pull_request' }
            ]
          }
        }
      },
      {
        id: 'set_1',
        type: 'n8n-nodes-base.set',
        name: 'Format Message',
        position: { x: 500, y: 150 },
        parameters: {
          values: {
            string: [
              { name: 'title', value: '={{$json.body.pull_request.title}}' },
              { name: 'author', value: '={{$json.body.pull_request.user.login}}' },
              { name: 'action', value: '={{$json.body.action}}' },
              { name: 'url', value: '={{$json.body.pull_request.html_url}}' }
            ]
          }
        }
      },
      {
        id: 'slack_1',
        type: 'n8n-nodes-base.slack',
        name: 'Notify Team',
        position: { x: 700, y: 150 },
        parameters: {
          channel: '#dev-prs',
          text: ':git: PR *{{$json.action}}* by {{$json.author}}\n*{{$json.title}}*\n{{$json.url}}'
        }
      }
    ],
    connections: [
      { source: 'webhook_1', sourceHandle: 'main', target: 'if_1', targetHandle: 'main' },
      { source: 'if_1', sourceHandle: 'true', target: 'set_1', targetHandle: 'main' },
      { source: 'set_1', sourceHandle: 'main', target: 'slack_1', targetHandle: 'main' }
    ]
  },

  // ============================================
  // Automation Templates
  // ============================================
  {
    id: 'template_scheduled_report',
    name: 'Scheduled Report Generator',
    description: 'Generate and send a daily report with aggregated data.',
    category: 'Automation',
    tags: ['schedule', 'report', 'email', 'daily'],
    difficulty: 'intermediate',
    nodes: [
      {
        id: 'schedule_1',
        type: 'n8n-nodes-base.scheduleTrigger',
        name: 'Daily at 9 AM',
        position: { x: 100, y: 200 },
        parameters: {
          rule: { cronExpression: '0 9 * * *' }
        }
      },
      {
        id: 'http_1',
        type: 'n8n-nodes-base.httpRequest',
        name: 'Fetch Data',
        position: { x: 300, y: 200 },
        parameters: {
          url: 'https://api.example.com/daily-stats',
          method: 'GET'
        }
      },
      {
        id: 'code_1',
        type: 'n8n-nodes-base.code',
        name: 'Generate Report',
        position: { x: 500, y: 200 },
        parameters: {
          jsCode: `
const data = $input.first().json;
const report = {
  date: new Date().toLocaleDateString(),
  totalUsers: data.users || 0,
  activeUsers: data.activeUsers || 0,
  revenue: data.revenue || 0,
  summary: \`Daily Report - \${new Date().toLocaleDateString()}\`
};
return [{ json: report }];
`
        }
      },
      {
        id: 'email_1',
        type: 'n8n-nodes-base.emailSend',
        name: 'Send Report',
        position: { x: 700, y: 200 },
        parameters: {
          to: 'team@example.com',
          subject: 'Daily Report - {{$json.date}}',
          text: 'See attached daily report.'
        }
      }
    ],
    connections: [
      { source: 'schedule_1', sourceHandle: 'main', target: 'http_1', targetHandle: 'main' },
      { source: 'http_1', sourceHandle: 'main', target: 'code_1', targetHandle: 'main' },
      { source: 'code_1', sourceHandle: 'main', target: 'email_1', targetHandle: 'main' }
    ]
  },

  {
    id: 'template_data_sync',
    name: 'Database Sync',
    description: 'Synchronize data between two systems on a schedule.',
    category: 'Automation',
    tags: ['sync', 'database', 'schedule', 'etl'],
    difficulty: 'advanced',
    nodes: [
      {
        id: 'schedule_1',
        type: 'n8n-nodes-base.scheduleTrigger',
        name: 'Every Hour',
        position: { x: 100, y: 200 },
        parameters: {
          rule: { cronExpression: '0 * * * *' }
        }
      },
      {
        id: 'postgres_1',
        type: 'n8n-nodes-base.postgres',
        name: 'Get Source Data',
        position: { x: 300, y: 200 },
        parameters: {
          operation: 'select',
          query: 'SELECT * FROM users WHERE updated_at > NOW() - INTERVAL \'1 hour\''
        }
      },
      {
        id: 'if_1',
        type: 'n8n-nodes-base.if',
        name: 'Has Updates?',
        position: { x: 500, y: 200 },
        parameters: {
          conditions: {
            number: [
              { value1: '={{$json.length}}', operation: 'larger', value2: 0 }
            ]
          }
        }
      },
      {
        id: 'http_1',
        type: 'n8n-nodes-base.httpRequest',
        name: 'Sync to Target',
        position: { x: 700, y: 150 },
        parameters: {
          url: 'https://api.target.com/sync',
          method: 'POST',
          bodyParametersJson: '={{ $json }}'
        }
      },
      {
        id: 'noop_1',
        type: 'n8n-nodes-base.noOp',
        name: 'No Updates',
        position: { x: 700, y: 250 },
        parameters: {}
      }
    ],
    connections: [
      { source: 'schedule_1', sourceHandle: 'main', target: 'postgres_1', targetHandle: 'main' },
      { source: 'postgres_1', sourceHandle: 'main', target: 'if_1', targetHandle: 'main' },
      { source: 'if_1', sourceHandle: 'true', target: 'http_1', targetHandle: 'main' },
      { source: 'if_1', sourceHandle: 'false', target: 'noop_1', targetHandle: 'main' }
    ]
  },

  // ============================================
  // AI/ML Templates
  // ============================================
  {
    id: 'template_ai_content',
    name: 'AI Content Generator',
    description: 'Generate content using AI and post to various platforms.',
    category: 'AI/ML',
    tags: ['ai', 'openai', 'content', 'automation'],
    difficulty: 'intermediate',
    nodes: [
      {
        id: 'trigger_1',
        type: 'n8n-nodes-base.manualTrigger',
        name: 'Start',
        position: { x: 100, y: 200 },
        parameters: {}
      },
      {
        id: 'openai_1',
        type: 'n8n-nodes-base.openAi',
        name: 'Generate Content',
        position: { x: 300, y: 200 },
        parameters: {
          operation: 'text',
          prompt: 'Write a professional blog post about: {{$json.topic}}',
          maxTokens: 1000
        }
      },
      {
        id: 'set_1',
        type: 'n8n-nodes-base.set',
        name: 'Format Post',
        position: { x: 500, y: 200 },
        parameters: {
          values: {
            string: [
              { name: 'content', value: '={{$json.text}}' },
              { name: 'createdAt', value: '={{new Date().toISOString()}}' }
            ]
          }
        }
      },
      {
        id: 'http_1',
        type: 'n8n-nodes-base.httpRequest',
        name: 'Publish',
        position: { x: 700, y: 200 },
        parameters: {
          url: 'https://api.blog.com/posts',
          method: 'POST',
          bodyParametersJson: '={{ $json }}'
        }
      }
    ],
    connections: [
      { source: 'trigger_1', sourceHandle: 'main', target: 'openai_1', targetHandle: 'main' },
      { source: 'openai_1', sourceHandle: 'main', target: 'set_1', targetHandle: 'main' },
      { source: 'set_1', sourceHandle: 'main', target: 'http_1', targetHandle: 'main' }
    ]
  },

  {
    id: 'template_sentiment_analysis',
    name: 'Sentiment Analysis Pipeline',
    description: 'Analyze sentiment of incoming messages and route based on sentiment.',
    category: 'AI/ML',
    tags: ['ai', 'sentiment', 'analysis', 'nlp'],
    difficulty: 'advanced',
    nodes: [
      {
        id: 'webhook_1',
        type: 'n8n-nodes-base.webhook',
        name: 'Receive Message',
        position: { x: 100, y: 200 },
        parameters: {
          path: 'analyze-sentiment',
          httpMethod: 'POST'
        }
      },
      {
        id: 'openai_1',
        type: 'n8n-nodes-base.openAi',
        name: 'Analyze Sentiment',
        position: { x: 300, y: 200 },
        parameters: {
          operation: 'text',
          prompt: 'Analyze the sentiment of this text and respond with only one word: positive, negative, or neutral.\n\nText: {{$json.message}}'
        }
      },
      {
        id: 'switch_1',
        type: 'n8n-nodes-base.switch',
        name: 'Route by Sentiment',
        position: { x: 500, y: 200 },
        parameters: {
          dataPropertyName: 'text',
          rules: {
            rules: [
              { value: 'positive', output: 0 },
              { value: 'negative', output: 1 },
              { value: 'neutral', output: 2 }
            ]
          }
        }
      },
      {
        id: 'slack_positive',
        type: 'n8n-nodes-base.slack',
        name: 'Positive Feedback',
        position: { x: 700, y: 100 },
        parameters: {
          channel: '#positive-feedback',
          text: ':smile: Positive message received'
        }
      },
      {
        id: 'slack_negative',
        type: 'n8n-nodes-base.slack',
        name: 'Escalate Negative',
        position: { x: 700, y: 200 },
        parameters: {
          channel: '#support-urgent',
          text: ':warning: Negative message needs attention'
        }
      },
      {
        id: 'noop_1',
        type: 'n8n-nodes-base.noOp',
        name: 'Archive Neutral',
        position: { x: 700, y: 300 },
        parameters: {}
      }
    ],
    connections: [
      { source: 'webhook_1', sourceHandle: 'main', target: 'openai_1', targetHandle: 'main' },
      { source: 'openai_1', sourceHandle: 'main', target: 'switch_1', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '0', target: 'slack_positive', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '1', target: 'slack_negative', targetHandle: 'main' },
      { source: 'switch_1', sourceHandle: '2', target: 'noop_1', targetHandle: 'main' }
    ]
  },

  // ============================================
  // Error Handling Template
  // ============================================
  {
    id: 'template_error_handling',
    name: 'Error Handling & Retry Pattern',
    description: 'Demonstrate proper error handling with retries and notifications.',
    category: 'Patterns',
    tags: ['error', 'retry', 'patterns', 'best-practices'],
    difficulty: 'intermediate',
    nodes: [
      {
        id: 'trigger_1',
        type: 'n8n-nodes-base.manualTrigger',
        name: 'Start',
        position: { x: 100, y: 200 },
        parameters: {}
      },
      {
        id: 'http_1',
        type: 'n8n-nodes-base.httpRequest',
        name: 'API Call',
        position: { x: 300, y: 200 },
        parameters: {
          url: 'https://api.example.com/data',
          method: 'GET',
          options: {
            retry: { maxRetries: 3, retryInterval: 1000 }
          }
        }
      },
      {
        id: 'if_1',
        type: 'n8n-nodes-base.if',
        name: 'Check Response',
        position: { x: 500, y: 200 },
        parameters: {
          conditions: {
            number: [
              { value1: '={{$json.statusCode}}', operation: 'equal', value2: 200 }
            ]
          }
        }
      },
      {
        id: 'success_1',
        type: 'n8n-nodes-base.set',
        name: 'Process Success',
        position: { x: 700, y: 150 },
        parameters: {
          values: {
            string: [
              { name: 'status', value: 'success' }
            ]
          }
        }
      },
      {
        id: 'error_1',
        type: 'n8n-nodes-base.slack',
        name: 'Alert on Failure',
        position: { x: 700, y: 250 },
        parameters: {
          channel: '#alerts',
          text: ':x: API call failed after retries'
        }
      }
    ],
    connections: [
      { source: 'trigger_1', sourceHandle: 'main', target: 'http_1', targetHandle: 'main' },
      { source: 'http_1', sourceHandle: 'main', target: 'if_1', targetHandle: 'main' },
      { source: 'if_1', sourceHandle: 'true', target: 'success_1', targetHandle: 'main' },
      { source: 'if_1', sourceHandle: 'false', target: 'error_1', targetHandle: 'main' }
    ]
  }
];

// Helper functions
export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return workflowTemplates.filter(t => t.category === category);
}

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find(t => t.id === id);
}

export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return workflowTemplates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getTemplateCategories(): string[] {
  return [...new Set(workflowTemplates.map(t => t.category))];
}

export default workflowTemplates;

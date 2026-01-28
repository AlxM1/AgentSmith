/**
 * AgentSmith Workflow Templates
 * Pre-built workflow templates for common use cases
 */

import React, { useState } from 'react';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
  nodes: any[];
  connections: any[];
  requiredCredentials: string[];
  popular?: boolean;
  new?: boolean;
}

// Pre-defined workflow templates
export const workflowTemplates: WorkflowTemplate[] = [
  // Communication Templates
  {
    id: 'slack-webhook-notification',
    name: 'Slack Notification on Webhook',
    description: 'Send a Slack message whenever a webhook is received',
    category: 'Communication',
    icon: '💬',
    difficulty: 'beginner',
    estimatedTime: '5 min',
    tags: ['slack', 'webhook', 'notification'],
    popular: true,
    nodes: [
      {
        id: 'webhook_1',
        type: 'Webhook',
        position: { x: 100, y: 200 },
        data: { label: 'Webhook Trigger' },
      },
      {
        id: 'slack_1',
        type: 'Slack',
        position: { x: 400, y: 200 },
        data: { label: 'Send Slack Message' },
      },
    ],
    connections: [
      { source: 'webhook_1', target: 'slack_1' },
    ],
    requiredCredentials: ['Slack'],
  },
  {
    id: 'email-to-slack',
    name: 'Forward Important Emails to Slack',
    description: 'Monitor Gmail and forward important emails to a Slack channel',
    category: 'Communication',
    icon: '📧',
    difficulty: 'intermediate',
    estimatedTime: '10 min',
    tags: ['email', 'gmail', 'slack', 'filter'],
    nodes: [
      {
        id: 'schedule_1',
        type: 'Schedule',
        position: { x: 100, y: 200 },
        data: { label: 'Every 5 minutes' },
      },
      {
        id: 'gmail_1',
        type: 'Gmail',
        position: { x: 300, y: 200 },
        data: { label: 'Get Emails' },
      },
      {
        id: 'filter_1',
        type: 'Filter',
        position: { x: 500, y: 200 },
        data: { label: 'Filter Important' },
      },
      {
        id: 'slack_1',
        type: 'Slack',
        position: { x: 700, y: 200 },
        data: { label: 'Send to Slack' },
      },
    ],
    connections: [
      { source: 'schedule_1', target: 'gmail_1' },
      { source: 'gmail_1', target: 'filter_1' },
      { source: 'filter_1', target: 'slack_1' },
    ],
    requiredCredentials: ['Gmail', 'Slack'],
  },

  // Data Processing Templates
  {
    id: 'daily-report',
    name: 'Automated Daily Report',
    description: 'Generate and send a daily report from your data sources',
    category: 'Data',
    icon: '📊',
    difficulty: 'intermediate',
    estimatedTime: '15 min',
    tags: ['report', 'scheduled', 'email'],
    popular: true,
    nodes: [
      {
        id: 'schedule_1',
        type: 'Schedule',
        position: { x: 100, y: 200 },
        data: { label: 'Daily at 9 AM' },
      },
      {
        id: 'postgres_1',
        type: 'Postgres',
        position: { x: 300, y: 200 },
        data: { label: 'Query Database' },
      },
      {
        id: 'aggregate_1',
        type: 'Aggregate',
        position: { x: 500, y: 200 },
        data: { label: 'Aggregate Data' },
      },
      {
        id: 'code_1',
        type: 'Code',
        position: { x: 700, y: 200 },
        data: { label: 'Format Report' },
      },
      {
        id: 'gmail_1',
        type: 'Gmail',
        position: { x: 900, y: 200 },
        data: { label: 'Send Email' },
      },
    ],
    connections: [
      { source: 'schedule_1', target: 'postgres_1' },
      { source: 'postgres_1', target: 'aggregate_1' },
      { source: 'aggregate_1', target: 'code_1' },
      { source: 'code_1', target: 'gmail_1' },
    ],
    requiredCredentials: ['PostgreSQL', 'Gmail'],
  },
  {
    id: 'csv-to-database',
    name: 'CSV Import to Database',
    description: 'Import data from CSV files into your database',
    category: 'Data',
    icon: '📁',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    tags: ['csv', 'database', 'import'],
    nodes: [
      {
        id: 'manual_1',
        type: 'ManualTrigger',
        position: { x: 100, y: 200 },
        data: { label: 'Manual Trigger' },
      },
      {
        id: 'http_1',
        type: 'HttpRequest',
        position: { x: 300, y: 200 },
        data: { label: 'Download CSV' },
      },
      {
        id: 'spreadsheet_1',
        type: 'Spreadsheet',
        position: { x: 500, y: 200 },
        data: { label: 'Parse CSV' },
      },
      {
        id: 'postgres_1',
        type: 'Postgres',
        position: { x: 700, y: 200 },
        data: { label: 'Insert to DB' },
      },
    ],
    connections: [
      { source: 'manual_1', target: 'http_1' },
      { source: 'http_1', target: 'spreadsheet_1' },
      { source: 'spreadsheet_1', target: 'postgres_1' },
    ],
    requiredCredentials: ['PostgreSQL'],
  },

  // AI Templates
  {
    id: 'ai-content-generator',
    name: 'AI Content Generator',
    description: 'Generate blog posts or articles using AI',
    category: 'AI',
    icon: '🤖',
    difficulty: 'intermediate',
    estimatedTime: '10 min',
    tags: ['ai', 'openai', 'content', 'writing'],
    popular: true,
    new: true,
    nodes: [
      {
        id: 'manual_1',
        type: 'ManualTrigger',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'set_1',
        type: 'Set',
        position: { x: 300, y: 200 },
        data: { label: 'Set Topic' },
      },
      {
        id: 'openai_1',
        type: 'OpenAI',
        position: { x: 500, y: 200 },
        data: { label: 'Generate Content' },
      },
      {
        id: 'notion_1',
        type: 'Notion',
        position: { x: 700, y: 200 },
        data: { label: 'Save to Notion' },
      },
    ],
    connections: [
      { source: 'manual_1', target: 'set_1' },
      { source: 'set_1', target: 'openai_1' },
      { source: 'openai_1', target: 'notion_1' },
    ],
    requiredCredentials: ['OpenAI', 'Notion'],
  },
  {
    id: 'sentiment-analysis',
    name: 'Customer Feedback Sentiment Analysis',
    description: 'Analyze customer feedback sentiment using AI',
    category: 'AI',
    icon: '😊',
    difficulty: 'advanced',
    estimatedTime: '20 min',
    tags: ['ai', 'sentiment', 'analysis', 'feedback'],
    new: true,
    nodes: [
      {
        id: 'schedule_1',
        type: 'Schedule',
        position: { x: 100, y: 200 },
        data: { label: 'Every Hour' },
      },
      {
        id: 'airtable_1',
        type: 'Airtable',
        position: { x: 300, y: 200 },
        data: { label: 'Get Feedback' },
      },
      {
        id: 'openai_1',
        type: 'OpenAI',
        position: { x: 500, y: 200 },
        data: { label: 'Analyze Sentiment' },
      },
      {
        id: 'if_1',
        type: 'If',
        position: { x: 700, y: 200 },
        data: { label: 'Check Negative' },
      },
      {
        id: 'slack_1',
        type: 'Slack',
        position: { x: 900, y: 150 },
        data: { label: 'Alert Team' },
      },
      {
        id: 'airtable_2',
        type: 'Airtable',
        position: { x: 900, y: 250 },
        data: { label: 'Update Record' },
      },
    ],
    connections: [
      { source: 'schedule_1', target: 'airtable_1' },
      { source: 'airtable_1', target: 'openai_1' },
      { source: 'openai_1', target: 'if_1' },
      { source: 'if_1', target: 'slack_1' },
      { source: 'if_1', target: 'airtable_2' },
    ],
    requiredCredentials: ['Airtable', 'OpenAI', 'Slack'],
  },

  // Social Media Templates
  {
    id: 'social-media-monitor',
    name: 'Social Media Mention Monitor',
    description: 'Monitor social media for brand mentions',
    category: 'Social',
    icon: '📱',
    difficulty: 'intermediate',
    estimatedTime: '15 min',
    tags: ['social', 'twitter', 'monitoring', 'alerts'],
    nodes: [
      {
        id: 'schedule_1',
        type: 'Schedule',
        position: { x: 100, y: 200 },
        data: { label: 'Every 15 min' },
      },
      {
        id: 'twitter_1',
        type: 'Twitter',
        position: { x: 300, y: 200 },
        data: { label: 'Search Mentions' },
      },
      {
        id: 'filter_1',
        type: 'Filter',
        position: { x: 500, y: 200 },
        data: { label: 'Filter New' },
      },
      {
        id: 'discord_1',
        type: 'Discord',
        position: { x: 700, y: 200 },
        data: { label: 'Send Alert' },
      },
    ],
    connections: [
      { source: 'schedule_1', target: 'twitter_1' },
      { source: 'twitter_1', target: 'filter_1' },
      { source: 'filter_1', target: 'discord_1' },
    ],
    requiredCredentials: ['Twitter', 'Discord'],
  },

  // E-commerce Templates
  {
    id: 'new-order-notification',
    name: 'New Order Notification',
    description: 'Get notified instantly when a new order comes in',
    category: 'E-commerce',
    icon: '🛒',
    difficulty: 'beginner',
    estimatedTime: '5 min',
    tags: ['shopify', 'orders', 'notification'],
    popular: true,
    nodes: [
      {
        id: 'webhook_1',
        type: 'Webhook',
        position: { x: 100, y: 200 },
        data: { label: 'Shopify Webhook' },
      },
      {
        id: 'set_1',
        type: 'Set',
        position: { x: 300, y: 200 },
        data: { label: 'Format Order' },
      },
      {
        id: 'slack_1',
        type: 'Slack',
        position: { x: 500, y: 200 },
        data: { label: 'Notify Team' },
      },
    ],
    connections: [
      { source: 'webhook_1', target: 'set_1' },
      { source: 'set_1', target: 'slack_1' },
    ],
    requiredCredentials: ['Slack'],
  },

  // Research & Scraping Templates
  {
    id: 'competitor-price-monitor',
    name: 'Competitor Price Monitor',
    description: 'Track competitor prices and get alerts on changes',
    category: 'Research',
    icon: '💰',
    difficulty: 'advanced',
    estimatedTime: '25 min',
    tags: ['scraping', 'prices', 'monitoring', 'alerts'],
    new: true,
    nodes: [
      {
        id: 'schedule_1',
        type: 'Schedule',
        position: { x: 100, y: 200 },
        data: { label: 'Daily' },
      },
      {
        id: 'pricetracker_1',
        type: 'PriceTracker',
        position: { x: 300, y: 200 },
        data: { label: 'Check Prices' },
      },
      {
        id: 'if_1',
        type: 'If',
        position: { x: 500, y: 200 },
        data: { label: 'Price Changed?' },
      },
      {
        id: 'sheets_1',
        type: 'GoogleSheets',
        position: { x: 700, y: 150 },
        data: { label: 'Log to Sheet' },
      },
      {
        id: 'slack_1',
        type: 'Slack',
        position: { x: 700, y: 250 },
        data: { label: 'Alert' },
      },
    ],
    connections: [
      { source: 'schedule_1', target: 'pricetracker_1' },
      { source: 'pricetracker_1', target: 'if_1' },
      { source: 'if_1', target: 'sheets_1' },
      { source: 'if_1', target: 'slack_1' },
    ],
    requiredCredentials: ['GoogleSheets', 'Slack'],
  },
];

// Component Props
interface WorkflowTemplatesProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onClose?: () => void;
}

// Main Component
export function WorkflowTemplates({ onSelectTemplate, onClose }: WorkflowTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const categories = [...new Set(workflowTemplates.map(t => t.category))];

  const filteredTemplates = workflowTemplates.filter(template => {
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || template.difficulty === selectedDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Workflow Templates</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty filter */}
        <div className="flex gap-2 mt-2">
          {['beginner', 'intermediate', 'advanced'].map(level => (
            <button
              key={level}
              onClick={() => setSelectedDifficulty(selectedDifficulty === level ? null : level)}
              className={`px-3 py-1 rounded-full text-xs transition-colors capitalize ${
                selectedDifficulty === level
                  ? level === 'beginner'
                    ? 'bg-green-600 text-white'
                    : level === 'intermediate'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onSelectTemplate(template)}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl block mb-4">🔍</span>
            <p>No templates found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onSelect,
}: {
  template: WorkflowTemplate;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{template.icon}</span>
        <div className="flex gap-1">
          {template.popular && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              ⭐ Popular
            </span>
          )}
          {template.new && (
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
              New
            </span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
        {template.name}
      </h3>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{template.description}</p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              template.difficulty === 'beginner'
                ? 'bg-green-100 text-green-700'
                : template.difficulty === 'intermediate'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {template.difficulty}
          </span>
          <span className="text-xs text-gray-500">⏱ {template.estimatedTime}</span>
        </div>
        <span className="text-xs text-gray-400">{template.category}</span>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {template.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs text-gray-400">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default WorkflowTemplates;

// Template Browser Component
import React, { useState, useMemo } from 'react';
import { Search, Grid, List, ChevronRight, Play, Plus, Tag, Clock, Star } from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  nodes: unknown[];
  connections: unknown[];
}

// Import templates from shared package
const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'template_data_transform',
    name: 'Data Transform Pipeline',
    description: 'Transform and filter data from a webhook, process it, and send results via HTTP.',
    category: 'Data Processing',
    tags: ['data', 'transform', 'webhook', 'http'],
    difficulty: 'beginner',
    nodes: [],
    connections: []
  },
  {
    id: 'template_csv_processor',
    name: 'CSV File Processor',
    description: 'Read a CSV file, process each row, and output results.',
    category: 'Data Processing',
    tags: ['csv', 'file', 'batch', 'processing'],
    difficulty: 'beginner',
    nodes: [],
    connections: []
  },
  {
    id: 'template_slack_notification',
    name: 'Slack Notification Bot',
    description: 'Receive webhook events and send notifications to Slack channels.',
    category: 'Integrations',
    tags: ['slack', 'notification', 'webhook', 'alerts'],
    difficulty: 'beginner',
    nodes: [],
    connections: []
  },
  {
    id: 'template_github_pr_notifier',
    name: 'GitHub PR Notifier',
    description: 'Monitor GitHub pull requests and send notifications on updates.',
    category: 'Integrations',
    tags: ['github', 'pr', 'notification', 'devops'],
    difficulty: 'intermediate',
    nodes: [],
    connections: []
  },
  {
    id: 'template_scheduled_report',
    name: 'Scheduled Report Generator',
    description: 'Generate and send a daily report with aggregated data.',
    category: 'Automation',
    tags: ['schedule', 'report', 'email', 'daily'],
    difficulty: 'intermediate',
    nodes: [],
    connections: []
  },
  {
    id: 'template_data_sync',
    name: 'Database Sync',
    description: 'Synchronize data between two systems on a schedule.',
    category: 'Automation',
    tags: ['sync', 'database', 'schedule', 'etl'],
    difficulty: 'advanced',
    nodes: [],
    connections: []
  },
  {
    id: 'template_ai_content',
    name: 'AI Content Generator',
    description: 'Generate content using AI and post to various platforms.',
    category: 'AI/ML',
    tags: ['ai', 'openai', 'content', 'automation'],
    difficulty: 'intermediate',
    nodes: [],
    connections: []
  },
  {
    id: 'template_sentiment_analysis',
    name: 'Sentiment Analysis Pipeline',
    description: 'Analyze sentiment of incoming messages and route based on sentiment.',
    category: 'AI/ML',
    tags: ['ai', 'sentiment', 'analysis', 'nlp'],
    difficulty: 'advanced',
    nodes: [],
    connections: []
  },
  {
    id: 'template_error_handling',
    name: 'Error Handling & Retry Pattern',
    description: 'Demonstrate proper error handling with retries and notifications.',
    category: 'Patterns',
    tags: ['error', 'retry', 'patterns', 'best-practices'],
    difficulty: 'intermediate',
    nodes: [],
    connections: []
  }
];

interface TemplateBrowserProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onClose?: () => void;
}

const difficultyColors = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const categoryIcons: Record<string, string> = {
  'Data Processing': '📊',
  'Integrations': '🔗',
  'Automation': '⚡',
  'AI/ML': '🤖',
  'Patterns': '📐'
};

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  onSelectTemplate,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(workflowTemplates.map(t => t.category))];
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return workflowTemplates.filter(template => {
      const matchesSearch = searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === null ||
        template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleUseTemplate = (template: WorkflowTemplate) => {
    onSelectTemplate(template);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Workflow Templates
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Categories */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Categories
          </h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                All Templates
              </button>
            </li>
            {categories.map(category => (
              <li key={category}>
                <button
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>{categoryIcons[category] || '📁'}</span>
                  {category}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTemplate ? (
            // Template Detail View
            <div className="max-w-2xl">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                Back to templates
              </button>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedTemplate.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedTemplate.category}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[selectedTemplate.difficulty]}`}>
                    {selectedTemplate.difficulty}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {selectedTemplate.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedTemplate.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleUseTemplate(selectedTemplate)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Use Template
                  </button>
                  <button
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Template Grid/List View
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {filteredTemplates.length} templates found
                </p>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{categoryIcons[template.category] || '📁'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyColors[template.difficulty]}`}>
                          {template.difficulty}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {template.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{template.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
                    >
                      <span className="text-2xl">{categoryIcons[template.category] || '📁'}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {template.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {template.description}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[template.difficulty]}`}>
                        {template.difficulty}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              )}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No templates found
                  </h3>
                  <p className="text-gray-500">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateBrowser;

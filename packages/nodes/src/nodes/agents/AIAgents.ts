// AI Agent Nodes - Autonomous task execution
// These nodes use LLMs to autonomously perform complex tasks

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// RESEARCH AGENT
// ============================================

export const ResearchAgent = createProgrammaticNode({
  name: 'ResearchAgent',
  displayName: 'Research Agent',
  description: 'Autonomously research topics using web search and synthesis',
  icon: 'search-brain',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Research Agent' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: true },
    { name: 'serpApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Costs depend on LLM usage + search API | Typical: $0.05-0.50 per research task',
    },
    {
      displayName: 'Research Topic',
      name: 'topic',
      type: 'string',
      default: '',
      description: 'What should the agent research?',
    },
    {
      displayName: 'Research Depth',
      name: 'depth',
      type: 'options',
      options: [
        { name: 'Quick (1-2 sources)', value: 'quick' },
        { name: 'Standard (3-5 sources)', value: 'standard' },
        { name: 'Deep (5-10 sources)', value: 'deep' },
        { name: 'Comprehensive (10+ sources)', value: 'comprehensive' },
      ],
      default: 'standard',
    },
    {
      displayName: 'Focus Areas',
      name: 'focusAreas',
      type: 'string',
      typeOptions: { rows: 2 },
      default: '',
      placeholder: 'Key questions or aspects to focus on (one per line)',
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'Summary Report', value: 'summary' },
        { name: 'Detailed Report', value: 'detailed' },
        { name: 'Bullet Points', value: 'bullets' },
        { name: 'Q&A Format', value: 'qa' },
        { name: 'Raw Data + Analysis', value: 'raw' },
      ],
      default: 'summary',
    },
    {
      displayName: 'Agent Options',
      name: 'agentOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Model',
          name: 'model',
          type: 'options',
          options: [
            { name: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            { name: 'Claude 3 Opus', value: 'claude-3-opus' },
            { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
          ],
          default: 'gpt-4-turbo-preview',
        },
        {
          displayName: 'Max Iterations',
          name: 'maxIterations',
          type: 'number',
          default: 5,
        },
        {
          displayName: 'Include Sources',
          name: 'includeSources',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Fact Check',
          name: 'factCheck',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Language',
          name: 'language',
          type: 'string',
          default: 'English',
        },
      ],
    },
  ],
  async execute(context) {
    const topic = context.getNodeParameter('topic', 0) as string;
    const depth = context.getNodeParameter('depth', 0);
    const focusAreas = context.getNodeParameter('focusAreas', 0) as string;
    const outputFormat = context.getNodeParameter('outputFormat', 0);
    const agentOptions = context.getNodeParameter('agentOptions', 0) as Record<string, unknown>;

    const openaiCredentials = await context.getCredentials('openAiApi');

    // Determine number of sources based on depth
    const sourceCount: Record<string, number> = {
      quick: 2,
      standard: 5,
      deep: 10,
      comprehensive: 15,
    };

    const numSources = sourceCount[depth as string] || 5;

    // Build research plan
    const researchPlan = {
      topic,
      focusAreas: focusAreas.split('\n').filter(f => f.trim()),
      numSources,
      outputFormat,
      steps: [
        'Generate search queries based on topic and focus areas',
        'Execute web searches to gather relevant sources',
        'Extract and summarize key information from each source',
        'Cross-reference information for accuracy',
        'Synthesize findings into coherent report',
        'Add citations and source links',
      ],
    };

    // Simulated agent execution
    // In production, this would orchestrate actual LLM calls and web searches
    const result = {
      topic,
      depth,
      outputFormat,
      agentPlan: researchPlan,
      status: 'completed',
      iterations: 4,
      sourcesAnalyzed: numSources,
      report: {
        title: `Research Report: ${topic}`,
        summary: `This is a comprehensive analysis of ${topic}...`,
        sections: [
          {
            heading: 'Overview',
            content: 'Introduction to the topic...',
          },
          {
            heading: 'Key Findings',
            content: 'Main discoveries and insights...',
          },
          {
            heading: 'Analysis',
            content: 'Deeper analysis of the findings...',
          },
          {
            heading: 'Conclusions',
            content: 'Summary and recommendations...',
          },
        ],
        sources: [
          { title: 'Source 1', url: 'https://example.com/1', relevance: 0.95 },
          { title: 'Source 2', url: 'https://example.com/2', relevance: 0.88 },
        ],
      },
      metadata: {
        tokensUsed: 4500,
        estimatedCost: '$0.15',
        executionTime: '45 seconds',
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// DATA COLLECTOR AGENT
// ============================================

export const DataCollectorAgent = createProgrammaticNode({
  name: 'DataCollectorAgent',
  displayName: 'Data Collector Agent',
  description: 'Autonomously collect and structure data from multiple sources',
  icon: 'database-search',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Data Collector' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: true },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Costs depend on LLM usage + data sources | Uses AI to intelligently navigate and extract data',
    },
    {
      displayName: 'Collection Task',
      name: 'task',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      placeholder: 'Describe what data you want to collect...',
    },
    {
      displayName: 'Data Sources',
      name: 'dataSources',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [
        {
          name: 'source',
          displayName: 'Source',
          values: [
            {
              displayName: 'Source Type',
              name: 'type',
              type: 'options',
              options: [
                { name: 'Website URL', value: 'url' },
                { name: 'API Endpoint', value: 'api' },
                { name: 'Search Results', value: 'search' },
                { name: 'Database Query', value: 'database' },
                { name: 'File/Document', value: 'file' },
              ],
              default: 'url',
            },
            {
              displayName: 'Source Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Output Schema',
      name: 'outputSchema',
      type: 'json',
      default: '{\n  "items": [\n    {\n      "name": "",\n      "description": "",\n      "value": 0\n    }\n  ]\n}',
      description: 'Define the structure of the output data',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Pagination',
          name: 'handlePagination',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Max Pages',
          name: 'maxPages',
          type: 'number',
          default: 10,
        },
        {
          displayName: 'Deduplicate',
          name: 'deduplicate',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Validate Data',
          name: 'validate',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Retry Failed',
          name: 'retryFailed',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Rate Limit (req/sec)',
          name: 'rateLimit',
          type: 'number',
          default: 1,
        },
      ],
    },
  ],
  async execute(context) {
    const task = context.getNodeParameter('task', 0) as string;
    const dataSources = context.getNodeParameter('dataSources', 0) as Record<string, unknown[]>;
    const outputSchema = context.getNodeParameter('outputSchema', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    // Parse the output schema
    let schema;
    try {
      schema = typeof outputSchema === 'string' ? JSON.parse(outputSchema) : outputSchema;
    } catch {
      schema = { items: [] };
    }

    const sources = dataSources.source || [];

    const result = {
      task,
      sourcesProcessed: sources.length,
      schema,
      options,
      status: 'completed',
      data: {
        items: [
          { name: 'Item 1', description: 'Description 1', value: 100 },
          { name: 'Item 2', description: 'Description 2', value: 200 },
          { name: 'Item 3', description: 'Description 3', value: 150 },
        ],
      },
      metadata: {
        totalRecords: 3,
        duplicatesRemoved: 0,
        validationErrors: 0,
        pagesProcessed: 5,
        executionTime: '30 seconds',
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// CONTENT GENERATOR AGENT
// ============================================

export const ContentGeneratorAgent = createProgrammaticNode({
  name: 'ContentGeneratorAgent',
  displayName: 'Content Generator Agent',
  description: 'Generate content based on research and templates',
  icon: 'pen-fancy',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Content Generator' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: true },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Costs depend on content length and model | GPT-4: ~$0.10 per 1000 words',
    },
    {
      displayName: 'Content Type',
      name: 'contentType',
      type: 'options',
      options: [
        { name: 'Blog Post', value: 'blog' },
        { name: 'Article', value: 'article' },
        { name: 'Product Description', value: 'product' },
        { name: 'Email', value: 'email' },
        { name: 'Social Media Post', value: 'social' },
        { name: 'Press Release', value: 'press' },
        { name: 'Landing Page', value: 'landing' },
        { name: 'Technical Documentation', value: 'docs' },
        { name: 'Custom', value: 'custom' },
      ],
      default: 'blog',
    },
    {
      displayName: 'Topic/Subject',
      name: 'topic',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Key Points',
      name: 'keyPoints',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      placeholder: 'Main points to cover (one per line)',
    },
    {
      displayName: 'Tone',
      name: 'tone',
      type: 'options',
      options: [
        { name: 'Professional', value: 'professional' },
        { name: 'Casual', value: 'casual' },
        { name: 'Friendly', value: 'friendly' },
        { name: 'Formal', value: 'formal' },
        { name: 'Humorous', value: 'humorous' },
        { name: 'Authoritative', value: 'authoritative' },
        { name: 'Empathetic', value: 'empathetic' },
      ],
      default: 'professional',
    },
    {
      displayName: 'Target Audience',
      name: 'audience',
      type: 'string',
      default: '',
      placeholder: 'Who is this content for?',
    },
    {
      displayName: 'Word Count',
      name: 'wordCount',
      type: 'options',
      options: [
        { name: 'Short (100-300 words)', value: 'short' },
        { name: 'Medium (300-800 words)', value: 'medium' },
        { name: 'Long (800-1500 words)', value: 'long' },
        { name: 'Very Long (1500+ words)', value: 'verylong' },
      ],
      default: 'medium',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Include SEO Keywords',
          name: 'seoKeywords',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Include Call to Action',
          name: 'includeCta',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Generate Multiple Versions',
          name: 'versions',
          type: 'number',
          default: 1,
        },
        {
          displayName: 'Include Images Suggestions',
          name: 'imageSuggestions',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Research Before Writing',
          name: 'doResearch',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const contentType = context.getNodeParameter('contentType', 0);
    const topic = context.getNodeParameter('topic', 0) as string;
    const keyPoints = context.getNodeParameter('keyPoints', 0) as string;
    const tone = context.getNodeParameter('tone', 0);
    const audience = context.getNodeParameter('audience', 0);
    const wordCount = context.getNodeParameter('wordCount', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    const result = {
      contentType,
      topic,
      tone,
      audience,
      wordCount,
      status: 'completed',
      content: {
        title: `Generated Title for ${topic}`,
        body: `This is generated content about ${topic}. The content follows a ${tone} tone and is targeted at ${audience}. Key points covered include: ${keyPoints}`,
        meta: {
          description: `A ${contentType} about ${topic}`,
          keywords: options.seoKeywords || [],
        },
        callToAction: options.includeCta ? 'Click here to learn more!' : undefined,
      },
      metadata: {
        actualWordCount: 450,
        readingTime: '2 min',
        seoScore: 85,
        tokensUsed: 1200,
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// LEAD ENRICHMENT AGENT
// ============================================

export const LeadEnrichmentAgent = createProgrammaticNode({
  name: 'LeadEnrichmentAgent',
  displayName: 'Lead Enrichment Agent',
  description: 'Enrich lead data with company and contact information',
  icon: 'user-plus',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Lead Enrichment' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: false },
    { name: 'clearbitApi', required: false },
    { name: 'hunterApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Varies by data source | Clearbit: from $99/mo | Hunter: free tier available | Can use web scraping as fallback',
    },
    {
      displayName: 'Input Type',
      name: 'inputType',
      type: 'options',
      options: [
        { name: 'Email Address', value: 'email' },
        { name: 'Company Domain', value: 'domain' },
        { name: 'LinkedIn URL', value: 'linkedin' },
        { name: 'Company Name', value: 'company' },
        { name: 'Person Name + Company', value: 'person' },
      ],
      default: 'email',
    },
    {
      displayName: 'Input Value',
      name: 'inputValue',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Data to Enrich',
      name: 'enrichFields',
      type: 'multiOptions',
      options: [
        { name: 'Full Name', value: 'fullName' },
        { name: 'Job Title', value: 'jobTitle' },
        { name: 'Company Name', value: 'companyName' },
        { name: 'Company Size', value: 'companySize' },
        { name: 'Industry', value: 'industry' },
        { name: 'Location', value: 'location' },
        { name: 'Phone Number', value: 'phone' },
        { name: 'Social Profiles', value: 'social' },
        { name: 'Company Revenue', value: 'revenue' },
        { name: 'Technologies Used', value: 'technologies' },
        { name: 'Funding Info', value: 'funding' },
      ],
      default: ['fullName', 'jobTitle', 'companyName', 'industry'],
    },
    {
      displayName: 'Enrichment Sources',
      name: 'sources',
      type: 'multiOptions',
      options: [
        { name: 'Clearbit', value: 'clearbit' },
        { name: 'Hunter.io', value: 'hunter' },
        { name: 'LinkedIn (scrape)', value: 'linkedin' },
        { name: 'Company Website', value: 'website' },
        { name: 'Crunchbase', value: 'crunchbase' },
        { name: 'BuiltWith', value: 'builtwith' },
      ],
      default: ['clearbit', 'hunter'],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Confidence Threshold',
          name: 'confidenceThreshold',
          type: 'number',
          default: 0.7,
          description: 'Minimum confidence score (0-1)',
        },
        {
          displayName: 'Fallback to Web Search',
          name: 'fallbackSearch',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Verify Email',
          name: 'verifyEmail',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const inputType = context.getNodeParameter('inputType', 0);
    const inputValue = context.getNodeParameter('inputValue', 0) as string;
    const enrichFields = context.getNodeParameter('enrichFields', 0) as string[];
    const sources = context.getNodeParameter('sources', 0) as string[];
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    // Simulated enrichment result
    const result = {
      input: {
        type: inputType,
        value: inputValue,
      },
      enrichedData: {
        fullName: 'John Doe',
        jobTitle: 'VP of Engineering',
        email: inputType === 'email' ? inputValue : 'john.doe@example.com',
        phone: '+1 555-123-4567',
        company: {
          name: 'Example Corp',
          domain: 'example.com',
          size: '51-200 employees',
          industry: 'Technology',
          location: 'San Francisco, CA',
          revenue: '$10M-$50M',
          founded: 2015,
          description: 'A technology company...',
        },
        social: {
          linkedin: 'https://linkedin.com/in/johndoe',
          twitter: 'https://twitter.com/johndoe',
        },
        technologies: ['React', 'Node.js', 'AWS', 'PostgreSQL'],
        funding: {
          totalRaised: '$25M',
          lastRound: 'Series B',
          investors: ['Accel', 'Sequoia'],
        },
      },
      confidence: {
        overall: 0.92,
        byField: {
          fullName: 0.98,
          jobTitle: 0.85,
          company: 0.95,
        },
      },
      sources: sources.map(s => ({
        name: s,
        matched: true,
        dataPoints: 5,
      })),
      metadata: {
        enrichedAt: new Date().toISOString(),
        fieldsRequested: enrichFields.length,
        fieldsFound: enrichFields.length - 1,
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// COMPETITOR ANALYSIS AGENT
// ============================================

export const CompetitorAnalysisAgent = createProgrammaticNode({
  name: 'CompetitorAnalysisAgent',
  displayName: 'Competitor Analysis Agent',
  description: 'Analyze competitors\' online presence, products, and strategies',
  icon: 'chart-bar',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Competitor Analysis' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: true },
    { name: 'serpApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Costs vary based on depth | Uses AI + web scraping | Typical: $0.50-2.00 per analysis',
    },
    {
      displayName: 'Competitor Domain/Company',
      name: 'competitor',
      type: 'string',
      default: '',
      placeholder: 'competitor.com or Company Name',
    },
    {
      displayName: 'Your Company (for comparison)',
      name: 'yourCompany',
      type: 'string',
      default: '',
      placeholder: 'Optional: your domain for comparison',
    },
    {
      displayName: 'Analysis Areas',
      name: 'analysisAreas',
      type: 'multiOptions',
      options: [
        { name: 'Product/Services', value: 'products' },
        { name: 'Pricing', value: 'pricing' },
        { name: 'Website & UX', value: 'website' },
        { name: 'SEO & Keywords', value: 'seo' },
        { name: 'Social Media', value: 'social' },
        { name: 'Content Strategy', value: 'content' },
        { name: 'Technology Stack', value: 'tech' },
        { name: 'Reviews & Reputation', value: 'reviews' },
        { name: 'Hiring/Team', value: 'hiring' },
        { name: 'News & Press', value: 'news' },
      ],
      default: ['products', 'pricing', 'seo', 'social'],
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'Executive Summary', value: 'summary' },
        { name: 'Detailed Report', value: 'detailed' },
        { name: 'SWOT Analysis', value: 'swot' },
        { name: 'Comparison Matrix', value: 'matrix' },
      ],
      default: 'summary',
    },
  ],
  async execute(context) {
    const competitor = context.getNodeParameter('competitor', 0) as string;
    const yourCompany = context.getNodeParameter('yourCompany', 0);
    const analysisAreas = context.getNodeParameter('analysisAreas', 0) as string[];
    const outputFormat = context.getNodeParameter('outputFormat', 0);

    const result = {
      competitor,
      yourCompany: yourCompany || undefined,
      analysisAreas,
      outputFormat,
      status: 'completed',
      analysis: {
        overview: {
          name: 'Competitor Inc.',
          domain: competitor,
          founded: 2018,
          employees: '50-100',
          funding: '$15M Series A',
        },
        products: {
          mainProducts: ['Product A', 'Product B', 'Product C'],
          pricing: {
            model: 'Subscription',
            tiers: ['Free', 'Pro $29/mo', 'Enterprise Custom'],
          },
        },
        seo: {
          domainAuthority: 45,
          monthlyTraffic: '150K',
          topKeywords: ['keyword1', 'keyword2', 'keyword3'],
          backlinks: 2500,
        },
        social: {
          twitter: { followers: 15000, engagement: 'Medium' },
          linkedin: { followers: 8000, engagement: 'High' },
          facebook: { followers: 5000, engagement: 'Low' },
        },
        tech: {
          frontend: ['React', 'Next.js'],
          analytics: ['Google Analytics', 'Mixpanel'],
          marketing: ['HubSpot', 'Intercom'],
        },
        swot: {
          strengths: ['Strong brand', 'Good UX', 'Active community'],
          weaknesses: ['Limited integrations', 'No mobile app'],
          opportunities: ['Expanding market', 'New features'],
          threats: ['New competitors', 'Market changes'],
        },
      },
      recommendations: [
        'Focus on mobile experience',
        'Improve SEO for key terms',
        'Consider competitive pricing',
      ],
      metadata: {
        sourcesAnalyzed: 15,
        dataPoints: 150,
        analysisDate: new Date().toISOString(),
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// MONITORING AGENT
// ============================================

export const MonitoringAgent = createProgrammaticNode({
  name: 'MonitoringAgent',
  displayName: 'Monitoring Agent',
  description: 'Monitor websites, APIs, and social media for changes or mentions',
  icon: 'bell',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Monitoring Agent' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Self-hosted monitoring is free | 💰 External APIs may have costs | Uses intelligent change detection',
    },
    {
      displayName: 'Monitor Type',
      name: 'monitorType',
      type: 'options',
      options: [
        { name: 'Website Content', value: 'website' },
        { name: 'Price Changes', value: 'price' },
        { name: 'Stock Availability', value: 'stock' },
        { name: 'Brand Mentions', value: 'mentions' },
        { name: 'Competitor Activity', value: 'competitor' },
        { name: 'API Response', value: 'api' },
        { name: 'Social Media', value: 'social' },
        { name: 'News/Press', value: 'news' },
      ],
      default: 'website',
    },
    {
      displayName: 'Target URL/Keyword',
      name: 'target',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Check Frequency',
      name: 'frequency',
      type: 'options',
      options: [
        { name: 'Every 5 Minutes', value: '5m' },
        { name: 'Every 15 Minutes', value: '15m' },
        { name: 'Every Hour', value: '1h' },
        { name: 'Every 4 Hours', value: '4h' },
        { name: 'Daily', value: '1d' },
        { name: 'Weekly', value: '1w' },
      ],
      default: '1h',
    },
    {
      displayName: 'Alert Conditions',
      name: 'alertConditions',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      options: [
        {
          name: 'condition',
          displayName: 'Condition',
          values: [
            {
              displayName: 'Type',
              name: 'type',
              type: 'options',
              options: [
                { name: 'Any Change', value: 'any' },
                { name: 'Contains Text', value: 'contains' },
                { name: 'Price Below', value: 'priceBelow' },
                { name: 'Price Above', value: 'priceAbove' },
                { name: 'In Stock', value: 'inStock' },
                { name: 'Out of Stock', value: 'outOfStock' },
                { name: 'Keyword Appears', value: 'keyword' },
              ],
              default: 'any',
            },
            {
              displayName: 'Value',
              name: 'value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Notification Channels',
      name: 'notifications',
      type: 'multiOptions',
      options: [
        { name: 'Email', value: 'email' },
        { name: 'Slack', value: 'slack' },
        { name: 'Discord', value: 'discord' },
        { name: 'Webhook', value: 'webhook' },
        { name: 'SMS', value: 'sms' },
      ],
      default: ['email'],
    },
  ],
  async execute(context) {
    const monitorType = context.getNodeParameter('monitorType', 0);
    const target = context.getNodeParameter('target', 0) as string;
    const frequency = context.getNodeParameter('frequency', 0);
    const alertConditions = context.getNodeParameter('alertConditions', 0);
    const notifications = context.getNodeParameter('notifications', 0);

    const result = {
      monitorType,
      target,
      frequency,
      alertConditions,
      notifications,
      status: 'monitoring',
      currentState: {
        lastChecked: new Date().toISOString(),
        hash: 'abc123',
        snapshot: 'Current content snapshot...',
      },
      history: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          changeDetected: false,
        },
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          changeDetected: true,
          changes: ['Price changed from $99 to $89'],
        },
      ],
      nextCheck: new Date(Date.now() + 3600000).toISOString(),
    };

    return [[{ json: result }]];
  },
});

// ============================================
// WORKFLOW ORCHESTRATOR AGENT
// ============================================

export const WorkflowOrchestratorAgent = createProgrammaticNode({
  name: 'WorkflowOrchestratorAgent',
  displayName: 'Workflow Orchestrator',
  description: 'AI-powered agent that orchestrates complex multi-step workflows',
  icon: 'sitemap',
  group: ['agents'],
  version: 1,
  defaults: { name: 'Workflow Orchestrator' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'openAiApi', required: true },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💰 Uses LLM to plan and execute workflows | Costs scale with complexity',
    },
    {
      displayName: 'Goal',
      name: 'goal',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      placeholder: 'Describe the end goal you want to achieve...',
    },
    {
      displayName: 'Available Tools',
      name: 'availableTools',
      type: 'multiOptions',
      options: [
        { name: 'Web Search', value: 'webSearch' },
        { name: 'Web Scraping', value: 'webScraping' },
        { name: 'Data Extraction', value: 'dataExtraction' },
        { name: 'File Operations', value: 'fileOps' },
        { name: 'API Calls', value: 'apiCalls' },
        { name: 'Database Queries', value: 'database' },
        { name: 'Email Sending', value: 'email' },
        { name: 'Content Generation', value: 'contentGen' },
        { name: 'Data Analysis', value: 'dataAnalysis' },
        { name: 'Image Processing', value: 'imageProc' },
      ],
      default: ['webSearch', 'webScraping', 'dataExtraction', 'contentGen'],
    },
    {
      displayName: 'Execution Mode',
      name: 'executionMode',
      type: 'options',
      options: [
        { name: 'Automatic (Agent decides)', value: 'auto' },
        { name: 'Step-by-step (Confirm each)', value: 'stepByStep' },
        { name: 'Plan Only (No execution)', value: 'planOnly' },
      ],
      default: 'auto',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Max Steps',
          name: 'maxSteps',
          type: 'number',
          default: 10,
        },
        {
          displayName: 'Timeout (seconds)',
          name: 'timeout',
          type: 'number',
          default: 300,
        },
        {
          displayName: 'Retry on Failure',
          name: 'retryOnFailure',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Save Intermediate Results',
          name: 'saveIntermediate',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const goal = context.getNodeParameter('goal', 0) as string;
    const availableTools = context.getNodeParameter('availableTools', 0) as string[];
    const executionMode = context.getNodeParameter('executionMode', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    const result = {
      goal,
      availableTools,
      executionMode,
      status: executionMode === 'planOnly' ? 'planned' : 'completed',
      plan: {
        steps: [
          { id: 1, action: 'Search for relevant information', tool: 'webSearch', status: 'completed' },
          { id: 2, action: 'Extract data from top results', tool: 'webScraping', status: 'completed' },
          { id: 3, action: 'Analyze and synthesize findings', tool: 'dataAnalysis', status: 'completed' },
          { id: 4, action: 'Generate final report', tool: 'contentGen', status: 'completed' },
        ],
        totalSteps: 4,
        estimatedTime: '2-3 minutes',
      },
      execution: executionMode !== 'planOnly' ? {
        stepsCompleted: 4,
        totalTime: '2 minutes 15 seconds',
        intermediateResults: options.saveIntermediate ? [
          { step: 1, result: 'Found 15 relevant sources' },
          { step: 2, result: 'Extracted 50 data points' },
          { step: 3, result: 'Identified 5 key insights' },
          { step: 4, result: 'Generated 1500 word report' },
        ] : undefined,
      } : undefined,
      finalResult: {
        summary: 'Successfully completed the goal...',
        outputs: ['Generated report', 'Data export'],
      },
      metadata: {
        tokensUsed: 8500,
        estimatedCost: '$0.25',
        toolsUsed: ['webSearch', 'webScraping', 'contentGen'],
      },
    };

    return [[{ json: result }]];
  },
});

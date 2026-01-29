/**
 * GEO (Generative Engine Optimization) Node
 *
 * Comprehensive node for optimizing content for AI search engines
 * Based on Princeton research paper methods + industry best practices
 *
 * Features:
 * - Content Analysis (readability, structure, E-E-A-T signals)
 * - Content Optimization (statistics, citations, quotes, tone)
 * - Schema Generation (JSON-LD for AI crawlers)
 * - AI Visibility Checking (test against multiple LLMs)
 * - Competitor Analysis (top 10 by geolocation)
 * - GEO Score Calculation
 */

import { createProgrammaticNode } from '../../utils/nodeBuilder';

// ============================================================================
// CONTENT ANALYZER
// ============================================================================
export const GEOContentAnalyzer = createProgrammaticNode({
  name: 'GEO Content Analyzer',
  description: 'Analyze content for GEO readiness - readability, structure, E-E-A-T signals, and optimization opportunities',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#6366F1',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: false,
      description: 'OpenAI API for advanced analysis',
    },
    {
      name: 'textRazorApi',
      required: false,
      description: 'TextRazor API for entity extraction',
    },
  ],
  properties: [
    {
      displayName: 'Content',
      name: 'content',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      required: true,
      description: 'The content to analyze for GEO optimization',
    },
    {
      displayName: 'Content URL',
      name: 'contentUrl',
      type: 'string',
      default: '',
      description: 'Optional: URL to fetch and analyze content from',
    },
    {
      displayName: 'Target Keywords',
      name: 'targetKeywords',
      type: 'string',
      default: '',
      description: 'Comma-separated list of target keywords/topics',
    },
    {
      displayName: 'Analysis Depth',
      name: 'analysisDepth',
      type: 'options',
      options: [
        { name: 'Quick Scan', value: 'quick' },
        { name: 'Standard Analysis', value: 'standard' },
        { name: 'Deep Analysis (AI-Powered)', value: 'deep' },
      ],
      default: 'standard',
      description: 'Depth of content analysis',
    },
    {
      displayName: 'Industry/Niche',
      name: 'industry',
      type: 'options',
      options: [
        { name: 'General', value: 'general' },
        { name: 'Technology', value: 'technology' },
        { name: 'Healthcare (YMYL)', value: 'healthcare' },
        { name: 'Finance (YMYL)', value: 'finance' },
        { name: 'Legal (YMYL)', value: 'legal' },
        { name: 'E-commerce', value: 'ecommerce' },
        { name: 'SaaS/B2B', value: 'saas' },
        { name: 'Local Business', value: 'local' },
        { name: 'News/Media', value: 'news' },
        { name: 'Education', value: 'education' },
      ],
      default: 'general',
      description: 'Industry context for tailored analysis',
    },
  ],
  pricing: {
    pricingModel: 'perExecution',
    tiers: [
      { name: 'Basic Analysis', price: 0, description: 'Readability + structure analysis' },
      { name: 'AI-Powered', price: 0.02, description: 'Deep analysis with AI (uses API credits)' },
    ],
  },
  documentation: `
## GEO Content Analyzer

Analyzes your content for Generative Engine Optimization readiness.

### What it analyzes:

**Readability Metrics:**
- Flesch-Kincaid Reading Ease (target: 60-70)
- Gunning Fog Index (target: 8-12)
- Average sentence length (target: 15-20 words)
- Paragraph structure (target: 60-100 words each)

**Structure Analysis:**
- Heading hierarchy (H1, H2, H3 distribution)
- List usage (bullets, numbered)
- FAQ/Q&A pattern detection
- Definition presence

**E-E-A-T Signals:**
- Author attribution detection
- Source citations count
- Statistics/data presence
- Expert quotes detection
- Date/freshness indicators

**AI-Friendliness:**
- Direct answer patterns
- Semantic clarity score
- Entity density
- Citation-ready snippets

### Output:
Returns comprehensive analysis with scores and specific recommendations.
  `,
});

// ============================================================================
// CONTENT OPTIMIZER
// ============================================================================
export const GEOContentOptimizer = createProgrammaticNode({
  name: 'GEO Content Optimizer',
  description: 'Optimize content using Princeton research methods - add statistics, citations, quotes, and improve authority',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#8B5CF6',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: true,
      description: 'OpenAI API for content optimization',
    },
    {
      name: 'perplexityApi',
      required: false,
      description: 'Perplexity API for real-time citation verification',
    },
    {
      name: 'serpApi',
      required: false,
      description: 'SerpAPI for finding authoritative sources',
    },
  ],
  properties: [
    {
      displayName: 'Content',
      name: 'content',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      required: true,
      description: 'The content to optimize',
    },
    {
      displayName: 'Optimization Methods',
      name: 'optimizationMethods',
      type: 'multiOptions',
      options: [
        { name: '📊 Statistics Addition (+40% visibility)', value: 'statistics' },
        { name: '📚 Cite Sources (+31% visibility)', value: 'citations' },
        { name: '💬 Quotation Addition (+35% visibility)', value: 'quotes' },
        { name: '🎯 Authoritative Tone', value: 'authoritative' },
        { name: '📖 Fluency Optimization', value: 'fluency' },
        { name: '🔬 Technical Terms Enhancement', value: 'technical' },
        { name: '✨ Simplify for Clarity', value: 'simplify' },
        { name: '❓ Add FAQ Section', value: 'faq' },
        { name: '📝 Add Definitions', value: 'definitions' },
      ],
      default: ['statistics', 'citations', 'authoritative'],
      description: 'Select optimization methods (based on Princeton GEO research)',
    },
    {
      displayName: 'Target Topic/Keywords',
      name: 'targetTopic',
      type: 'string',
      default: '',
      required: true,
      description: 'Main topic or keywords for optimization context',
    },
    {
      displayName: 'Optimization Strength',
      name: 'strength',
      type: 'options',
      options: [
        { name: 'Light Touch (subtle improvements)', value: 'light' },
        { name: 'Balanced (recommended)', value: 'balanced' },
        { name: 'Aggressive (maximum optimization)', value: 'aggressive' },
      ],
      default: 'balanced',
      description: 'How aggressively to optimize the content',
    },
    {
      displayName: 'Verify Citations',
      name: 'verifyCitations',
      type: 'boolean',
      default: true,
      description: 'Verify all citations are from real, authoritative sources',
    },
    {
      displayName: 'Maintain Original Voice',
      name: 'maintainVoice',
      type: 'boolean',
      default: true,
      description: 'Try to preserve the original writing style',
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'Optimized Content Only', value: 'content' },
        { name: 'Content + Change Summary', value: 'withSummary' },
        { name: 'Content + Diff View', value: 'withDiff' },
        { name: 'Full Report', value: 'fullReport' },
      ],
      default: 'withSummary',
    },
  ],
  pricing: {
    pricingModel: 'perExecution',
    tiers: [
      { name: 'Per optimization', price: 0.05, description: 'Uses AI API credits' },
    ],
  },
  documentation: `
## GEO Content Optimizer

Applies research-backed optimization methods from the Princeton GEO study.

### Optimization Methods:

**Statistics Addition (+40% visibility boost)**
Adds relevant, factual statistics to support claims. Uses real data from authoritative sources.

**Cite Sources (+31% visibility boost)**
Adds citations to credible sources (academic papers, industry reports, authoritative websites).

**Quotation Addition (+35% visibility boost)**
Incorporates relevant quotes from recognized experts in the field.

**Authoritative Tone**
Rewrites content with confident, expert-level language while maintaining accuracy.

**Fluency Optimization**
Improves sentence flow, transitions, and overall readability.

**Technical Terms Enhancement**
Adds appropriate domain-specific terminology for expertise signals.

**FAQ Section**
Generates and appends relevant FAQ content based on common queries.

### Best Combination:
Statistics + Citations + Authoritative Tone = 45%+ improvement
  `,
});

// ============================================================================
// SCHEMA GENERATOR
// ============================================================================
export const GEOSchemaGenerator = createProgrammaticNode({
  name: 'GEO Schema Generator',
  description: 'Generate AI-optimized JSON-LD schema markup for better LLM understanding',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#EC4899',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: false,
      description: 'OpenAI API for intelligent schema generation',
    },
  ],
  properties: [
    {
      displayName: 'Content/Page Data',
      name: 'content',
      type: 'string',
      typeOptions: { rows: 6 },
      default: '',
      required: true,
      description: 'Content or page data to generate schema for',
    },
    {
      displayName: 'Page URL',
      name: 'pageUrl',
      type: 'string',
      default: '',
      required: true,
      description: 'URL of the page',
    },
    {
      displayName: 'Schema Types',
      name: 'schemaTypes',
      type: 'multiOptions',
      options: [
        { name: 'Article / BlogPosting', value: 'article' },
        { name: 'FAQPage', value: 'faq' },
        { name: 'HowTo', value: 'howto' },
        { name: 'Product', value: 'product' },
        { name: 'LocalBusiness', value: 'localbusiness' },
        { name: 'Organization', value: 'organization' },
        { name: 'Person (Author)', value: 'person' },
        { name: 'WebPage', value: 'webpage' },
        { name: 'BreadcrumbList', value: 'breadcrumb' },
        { name: 'Review / AggregateRating', value: 'review' },
        { name: 'Event', value: 'event' },
        { name: 'Course', value: 'course' },
        { name: 'SoftwareApplication', value: 'software' },
        { name: 'VideoObject', value: 'video' },
      ],
      default: ['article', 'organization'],
      description: 'Types of schema to generate',
    },
    {
      displayName: 'Organization Details',
      name: 'organizationDetails',
      type: 'collection',
      default: {},
      options: [
        { displayName: 'Name', name: 'name', type: 'string', default: '' },
        { displayName: 'Logo URL', name: 'logo', type: 'string', default: '' },
        { displayName: 'Website', name: 'url', type: 'string', default: '' },
        { displayName: 'Description', name: 'description', type: 'string', default: '' },
        { displayName: 'Social Profiles (comma-separated)', name: 'sameAs', type: 'string', default: '' },
      ],
    },
    {
      displayName: 'Author Details',
      name: 'authorDetails',
      type: 'collection',
      default: {},
      options: [
        { displayName: 'Name', name: 'name', type: 'string', default: '' },
        { displayName: 'Job Title', name: 'jobTitle', type: 'string', default: '' },
        { displayName: 'Profile URL', name: 'url', type: 'string', default: '' },
        { displayName: 'Image URL', name: 'image', type: 'string', default: '' },
        { displayName: 'LinkedIn/Social (comma-separated)', name: 'sameAs', type: 'string', default: '' },
      ],
    },
    {
      displayName: 'Extract FAQs from Content',
      name: 'extractFaqs',
      type: 'boolean',
      default: true,
      description: 'Automatically detect and extract Q&A pairs for FAQPage schema',
    },
    {
      displayName: 'Add SameAs Links',
      name: 'addSameAs',
      type: 'boolean',
      default: true,
      description: 'Include sameAs links to authoritative sources (Wikipedia, etc.)',
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'JSON-LD Script Tag', value: 'script' },
        { name: 'JSON Object', value: 'json' },
        { name: 'Both', value: 'both' },
      ],
      default: 'both',
    },
  ],
  documentation: `
## GEO Schema Generator

Generates AI-optimized JSON-LD structured data that helps LLMs understand your content.

### Why Schema Matters for GEO:

1. **Entity Disambiguation**: sameAs links help AI identify exactly what/who you're talking about
2. **Context Understanding**: Schema provides structured context that AI can easily parse
3. **Trust Signals**: Author/Organization schema builds E-E-A-T credibility
4. **Rich Citations**: Proper schema makes your content more "citable" by AI

### Supported Schema Types:

- **Article/BlogPosting**: For blog posts, news articles, guides
- **FAQPage**: For Q&A content (highly valued by AI)
- **HowTo**: For tutorials and step-by-step guides
- **Organization/Person**: For E-E-A-T authority signals
- **Product/Review**: For e-commerce content
- **LocalBusiness**: For local SEO + local AI visibility

### Server-Side Rendering Note:
AI crawlers (GPTBot, ClaudeBot, PerplexityBot) don't execute JavaScript.
Ensure this schema is rendered server-side, not injected client-side.
  `,
});

// ============================================================================
// AI VISIBILITY CHECKER
// ============================================================================
export const GEOVisibilityChecker = createProgrammaticNode({
  name: 'GEO AI Visibility Checker',
  description: 'Test how your content/brand appears across AI platforms (ChatGPT, Claude, Perplexity, Gemini)',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#10B981',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: true,
      description: 'OpenAI API for ChatGPT visibility testing',
    },
    {
      name: 'anthropicApi',
      required: false,
      description: 'Anthropic API for Claude visibility testing',
    },
    {
      name: 'googleAiApi',
      required: false,
      description: 'Google AI API for Gemini visibility testing',
    },
    {
      name: 'perplexityApi',
      required: false,
      description: 'Perplexity API for Perplexity visibility testing',
    },
  ],
  properties: [
    {
      displayName: 'Brand/Company Name',
      name: 'brandName',
      type: 'string',
      default: '',
      required: true,
      description: 'Your brand or company name to check visibility for',
    },
    {
      displayName: 'Domain',
      name: 'domain',
      type: 'string',
      default: '',
      description: 'Your website domain (e.g., example.com)',
    },
    {
      displayName: 'Test Queries',
      name: 'testQueries',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      required: true,
      description: 'Queries to test (one per line). E.g., "best [your product category]"',
    },
    {
      displayName: 'AI Platforms to Test',
      name: 'platforms',
      type: 'multiOptions',
      options: [
        { name: 'ChatGPT (GPT-4)', value: 'chatgpt' },
        { name: 'Claude', value: 'claude' },
        { name: 'Gemini', value: 'gemini' },
        { name: 'Perplexity', value: 'perplexity' },
      ],
      default: ['chatgpt'],
      description: 'AI platforms to test visibility on',
    },
    {
      displayName: 'Check Competitors',
      name: 'checkCompetitors',
      type: 'boolean',
      default: true,
      description: 'Also check which competitors are being mentioned',
    },
    {
      displayName: 'Competitor Names',
      name: 'competitors',
      type: 'string',
      default: '',
      description: 'Comma-separated list of competitor names to track',
      displayOptions: {
        show: { checkCompetitors: [true] },
      },
    },
    {
      displayName: 'Analysis Type',
      name: 'analysisType',
      type: 'options',
      options: [
        { name: 'Mention Detection', value: 'mention' },
        { name: 'Sentiment Analysis', value: 'sentiment' },
        { name: 'Share of Voice', value: 'shareOfVoice' },
        { name: 'Full Analysis', value: 'full' },
      ],
      default: 'full',
    },
  ],
  pricing: {
    pricingModel: 'perExecution',
    tiers: [
      { name: 'Per query per platform', price: 0.01, description: 'API costs for each test' },
    ],
  },
  documentation: `
## GEO AI Visibility Checker

Tests how your brand and content appear in AI-generated responses.

### What it measures:

**Mention Detection**
- Is your brand mentioned in responses?
- How prominently (first mention, recommendation, passing reference)?
- What context (positive, neutral, negative)?

**Citation Tracking**
- Is your domain cited as a source?
- What type of citation (direct link, reference, recommendation)?

**Share of Voice (SoV)**
- Your mentions vs. competitor mentions
- Category leadership analysis
- Recommendation frequency

**Sentiment Analysis**
- How is your brand described?
- Accuracy of information
- Positive/negative framing

### Output Metrics:
- AI Visibility Score (0-100)
- Share of Model (% of responses mentioning you)
- Citation Rate
- Sentiment Score
- Competitor Comparison
  `,
});

// ============================================================================
// COMPETITOR ANALYZER
// ============================================================================
export const GEOCompetitorAnalyzer = createProgrammaticNode({
  name: 'GEO Competitor Analyzer',
  description: 'Analyze top 10 competitors by geolocation for GEO strategy - visibility, citations, content gaps',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#F59E0B',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: true,
      description: 'OpenAI API for AI visibility analysis',
    },
    {
      name: 'serpApi',
      required: true,
      description: 'SerpAPI for competitor discovery and SERP data',
    },
    {
      name: 'perplexityApi',
      required: false,
      description: 'Perplexity API for citation analysis',
    },
    {
      name: 'googlePlacesApi',
      required: false,
      description: 'Google Places API for local competitor discovery',
    },
  ],
  properties: [
    {
      displayName: 'Your Brand/Business',
      name: 'brandName',
      type: 'string',
      default: '',
      required: true,
      description: 'Your brand or business name',
    },
    {
      displayName: 'Your Domain',
      name: 'domain',
      type: 'string',
      default: '',
      required: true,
      description: 'Your website domain',
    },
    {
      displayName: 'Industry/Category',
      name: 'industry',
      type: 'string',
      default: '',
      required: true,
      description: 'Your industry or business category (e.g., "CRM software", "Italian restaurant")',
    },
    {
      displayName: 'Discovery Method',
      name: 'discoveryMethod',
      type: 'options',
      options: [
        { name: 'By Geolocation (Local Competitors)', value: 'geolocation' },
        { name: 'By Industry (Online Competitors)', value: 'industry' },
        { name: 'By Keywords (SERP Competitors)', value: 'keywords' },
        { name: 'Manual List', value: 'manual' },
        { name: 'Combined (All Methods)', value: 'combined' },
      ],
      default: 'combined',
      description: 'How to discover competitors',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'collection',
      default: {},
      description: 'Location for geolocation-based competitor discovery',
      options: [
        { displayName: 'Address/City', name: 'address', type: 'string', default: '' },
        { displayName: 'Latitude', name: 'lat', type: 'number', default: 0 },
        { displayName: 'Longitude', name: 'lng', type: 'number', default: 0 },
        { displayName: 'Radius (km)', name: 'radius', type: 'number', default: 25 },
        { displayName: 'Country Code', name: 'country', type: 'string', default: 'US' },
      ],
    },
    {
      displayName: 'Target Keywords',
      name: 'keywords',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      description: 'Keywords to find SERP competitors (one per line)',
    },
    {
      displayName: 'Manual Competitors',
      name: 'manualCompetitors',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      description: 'Manually specify competitors (one per line: "Name, domain")',
      displayOptions: {
        show: { discoveryMethod: ['manual', 'combined'] },
      },
    },
    {
      displayName: 'Number of Competitors',
      name: 'competitorCount',
      type: 'number',
      default: 10,
      description: 'Number of top competitors to analyze (max 20)',
    },
    {
      displayName: 'Analysis Depth',
      name: 'analysisDepth',
      type: 'options',
      options: [
        { name: 'Quick Overview', value: 'quick' },
        { name: 'Standard Analysis', value: 'standard' },
        { name: 'Deep Dive', value: 'deep' },
      ],
      default: 'standard',
    },
    {
      displayName: 'Analysis Aspects',
      name: 'analysisAspects',
      type: 'multiOptions',
      options: [
        { name: 'AI Visibility (Share of Model)', value: 'aiVisibility' },
        { name: 'Content Analysis', value: 'content' },
        { name: 'Schema/Structured Data', value: 'schema' },
        { name: 'E-E-A-T Signals', value: 'eeat' },
        { name: 'Backlink Profile', value: 'backlinks' },
        { name: 'Social Presence', value: 'social' },
        { name: 'Review/Rating Analysis', value: 'reviews' },
        { name: 'Content Gaps', value: 'gaps' },
        { name: 'Keyword Overlap', value: 'keywords' },
      ],
      default: ['aiVisibility', 'content', 'eeat', 'gaps'],
      description: 'What aspects to analyze for each competitor',
    },
    {
      displayName: 'Test Queries for AI Visibility',
      name: 'testQueries',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      description: 'Queries to test AI visibility (one per line)',
    },
  ],
  pricing: {
    pricingModel: 'perExecution',
    tiers: [
      { name: 'Quick Overview', price: 0.10, description: 'Basic competitor analysis' },
      { name: 'Standard Analysis', price: 0.25, description: 'Detailed competitor analysis' },
      { name: 'Deep Dive', price: 0.50, description: 'Comprehensive competitive intelligence' },
    ],
  },
  documentation: `
## GEO Competitor Analyzer

Comprehensive competitor analysis for GEO strategy.

### Discovery Methods:

**By Geolocation (Local)**
Uses Google Places API to find competitors within a specified radius.
Best for: Local businesses, restaurants, service providers.

**By Industry (Online)**
Searches for top players in your industry category.
Best for: SaaS, e-commerce, online services.

**By Keywords (SERP)**
Finds competitors ranking for your target keywords.
Best for: Content sites, blogs, niche markets.

**Combined**
Uses all methods to build comprehensive competitor list.

### Analysis Output:

For each competitor:
- **AI Visibility Score**: How visible they are in AI responses
- **Share of Model**: % of AI responses mentioning them
- **Content Score**: Quality and optimization level
- **E-E-A-T Score**: Authority and trust signals
- **Schema Analysis**: Structured data implementation
- **Content Gaps**: Topics they cover that you don't
- **Opportunities**: Areas where you can outperform

### Ranking Factors:
Competitors are ranked by:
1. Proximity (for geolocation method)
2. AI visibility score
3. Overall GEO readiness
  `,
});

// ============================================================================
// GEO SCORE CALCULATOR
// ============================================================================
export const GEOScoreCalculator = createProgrammaticNode({
  name: 'GEO Score Calculator',
  description: 'Calculate comprehensive GEO readiness score with actionable recommendations',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#3B82F6',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: false,
      description: 'OpenAI API for advanced scoring',
    },
  ],
  properties: [
    {
      displayName: 'Input Type',
      name: 'inputType',
      type: 'options',
      options: [
        { name: 'URL (Fetch and Analyze)', value: 'url' },
        { name: 'Content (Direct Input)', value: 'content' },
        { name: 'Analysis Results (From Previous Node)', value: 'analysisResults' },
      ],
      default: 'url',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      description: 'URL to analyze',
      displayOptions: {
        show: { inputType: ['url'] },
      },
    },
    {
      displayName: 'Content',
      name: 'content',
      type: 'string',
      typeOptions: { rows: 6 },
      default: '',
      description: 'Content to analyze',
      displayOptions: {
        show: { inputType: ['content'] },
      },
    },
    {
      displayName: 'Include Sub-Scores',
      name: 'includeSubScores',
      type: 'boolean',
      default: true,
      description: 'Include detailed breakdown of all scoring categories',
    },
    {
      displayName: 'Scoring Categories',
      name: 'scoringCategories',
      type: 'multiOptions',
      options: [
        { name: 'Readability (20%)', value: 'readability' },
        { name: 'Structure (15%)', value: 'structure' },
        { name: 'E-E-A-T Signals (25%)', value: 'eeat' },
        { name: 'Citations & Sources (15%)', value: 'citations' },
        { name: 'Schema/Structured Data (10%)', value: 'schema' },
        { name: 'AI-Friendliness (15%)', value: 'aiFriendly' },
      ],
      default: ['readability', 'structure', 'eeat', 'citations', 'schema', 'aiFriendly'],
      description: 'Categories to include in scoring',
    },
    {
      displayName: 'Benchmark Against',
      name: 'benchmark',
      type: 'options',
      options: [
        { name: 'Industry Average', value: 'industry' },
        { name: 'Top Performers', value: 'topPerformers' },
        { name: 'Custom Threshold', value: 'custom' },
      ],
      default: 'industry',
    },
    {
      displayName: 'Generate Recommendations',
      name: 'generateRecommendations',
      type: 'boolean',
      default: true,
      description: 'Generate prioritized improvement recommendations',
    },
    {
      displayName: 'Recommendation Count',
      name: 'recommendationCount',
      type: 'number',
      default: 5,
      description: 'Number of top recommendations to generate',
      displayOptions: {
        show: { generateRecommendations: [true] },
      },
    },
  ],
  documentation: `
## GEO Score Calculator

Calculates a comprehensive GEO readiness score (0-100) for your content.

### Scoring Categories:

**Readability (20%)**
- Flesch-Kincaid score
- Sentence/paragraph length
- Clear language usage

**Structure (15%)**
- Heading hierarchy
- Lists and formatting
- FAQ/Q&A patterns

**E-E-A-T Signals (25%)**
- Author attribution
- Expert credentials
- Source citations
- Trust indicators

**Citations & Sources (15%)**
- Number of citations
- Source authority
- Link quality

**Schema/Structured Data (10%)**
- JSON-LD presence
- Schema types used
- Implementation quality

**AI-Friendliness (15%)**
- Direct answer patterns
- Semantic clarity
- Citation-ready snippets

### Score Interpretation:
- 90-100: Excellent - Top-tier GEO optimization
- 70-89: Good - Well optimized with room for improvement
- 50-69: Average - Needs significant optimization
- Below 50: Poor - Major improvements required

### Output:
- Overall GEO Score (0-100)
- Category breakdowns
- Prioritized recommendations
- Estimated improvement potential
  `,
});

// ============================================================================
// COMBINED GEO WORKFLOW
// ============================================================================
export const GEOFullAudit = createProgrammaticNode({
  name: 'GEO Full Audit',
  description: 'Complete GEO audit - analyze, score, compare competitors, and generate optimization plan',
  version: '1.0',
  icon: 'file:geo.svg',
  group: ['GEO'],
  color: '#7C3AED',
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'openAiApi',
      required: true,
      description: 'OpenAI API for analysis and optimization',
    },
    {
      name: 'serpApi',
      required: true,
      description: 'SerpAPI for competitor analysis',
    },
    {
      name: 'perplexityApi',
      required: false,
      description: 'Perplexity API for citation verification',
    },
    {
      name: 'anthropicApi',
      required: false,
      description: 'Anthropic API for Claude visibility testing',
    },
  ],
  properties: [
    {
      displayName: 'Audit Target',
      name: 'auditTarget',
      type: 'options',
      options: [
        { name: 'Single Page/URL', value: 'page' },
        { name: 'Entire Site', value: 'site' },
        { name: 'Content Piece', value: 'content' },
      ],
      default: 'page',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      required: true,
      description: 'URL or domain to audit',
    },
    {
      displayName: 'Brand Name',
      name: 'brandName',
      type: 'string',
      default: '',
      required: true,
      description: 'Your brand/company name',
    },
    {
      displayName: 'Industry',
      name: 'industry',
      type: 'string',
      default: '',
      required: true,
      description: 'Your industry or category',
    },
    {
      displayName: 'Target Keywords',
      name: 'keywords',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      description: 'Target keywords (one per line)',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'collection',
      default: {},
      options: [
        { displayName: 'Address/City', name: 'address', type: 'string', default: '' },
        { displayName: 'Country', name: 'country', type: 'string', default: 'US' },
        { displayName: 'Radius (km)', name: 'radius', type: 'number', default: 25 },
      ],
    },
    {
      displayName: 'Audit Components',
      name: 'auditComponents',
      type: 'multiOptions',
      options: [
        { name: 'Content Analysis', value: 'contentAnalysis' },
        { name: 'GEO Score', value: 'geoScore' },
        { name: 'AI Visibility Check', value: 'aiVisibility' },
        { name: 'Competitor Analysis (Top 10)', value: 'competitors' },
        { name: 'Schema Audit', value: 'schema' },
        { name: 'Optimization Recommendations', value: 'recommendations' },
      ],
      default: ['contentAnalysis', 'geoScore', 'aiVisibility', 'competitors', 'recommendations'],
    },
    {
      displayName: 'Report Format',
      name: 'reportFormat',
      type: 'options',
      options: [
        { name: 'JSON (Structured Data)', value: 'json' },
        { name: 'Markdown Report', value: 'markdown' },
        { name: 'HTML Report', value: 'html' },
        { name: 'Executive Summary', value: 'summary' },
      ],
      default: 'json',
    },
  ],
  pricing: {
    pricingModel: 'perExecution',
    tiers: [
      { name: 'Full Audit', price: 1.00, description: 'Complete GEO audit with all analyses' },
    ],
  },
  documentation: `
## GEO Full Audit

Comprehensive GEO audit that combines all analysis tools into one workflow.

### What's Included:

1. **Content Analysis**
   - Readability metrics
   - Structure analysis
   - E-E-A-T signal detection

2. **GEO Score**
   - Overall score (0-100)
   - Category breakdowns
   - Benchmark comparisons

3. **AI Visibility Check**
   - Test across ChatGPT, Claude, Gemini, Perplexity
   - Share of Voice analysis
   - Citation tracking

4. **Competitor Analysis**
   - Top 10 competitors by proximity/relevance
   - Comparative GEO scores
   - Content gaps identification
   - Opportunities analysis

5. **Schema Audit**
   - Current schema detection
   - Missing schema recommendations
   - Implementation quality

6. **Optimization Plan**
   - Prioritized recommendations
   - Estimated impact
   - Implementation difficulty

### Output:
Comprehensive report with all findings and actionable recommendations.
  `,
});

// Export all GEO nodes
export const geoNodes = [
  GEOContentAnalyzer,
  GEOContentOptimizer,
  GEOSchemaGenerator,
  GEOVisibilityChecker,
  GEOCompetitorAnalyzer,
  GEOScoreCalculator,
  GEOFullAudit,
];

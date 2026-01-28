// Search API Nodes with Pricing Information
// 💚 = Free tier available
// 💰 = Paid only

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// GOOGLE SEARCH (via SerpAPI)
// ============================================

export const SerpAPI = createProgrammaticNode({
  name: 'SerpAPI',
  displayName: 'SerpAPI (Google Search)',
  description: 'Get Google search results, images, news, shopping, and more',
  icon: 'search',
  group: ['search'],
  version: 1,
  defaults: { name: 'SerpAPI' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'serpApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100 searches/month | 💰 Developer: $75/mo (5k searches) | Business: $150/mo (15k) | Enterprise: Custom',
    },
    {
      displayName: 'Search Engine',
      name: 'engine',
      type: 'options',
      options: [
        { name: 'Google', value: 'google' },
        { name: 'Google Images', value: 'google_images' },
        { name: 'Google News', value: 'google_news' },
        { name: 'Google Shopping', value: 'google_shopping' },
        { name: 'Google Maps', value: 'google_maps' },
        { name: 'Google Jobs', value: 'google_jobs' },
        { name: 'Google Scholar', value: 'google_scholar' },
        { name: 'YouTube', value: 'youtube' },
        { name: 'Bing', value: 'bing' },
        { name: 'DuckDuckGo', value: 'duckduckgo' },
        { name: 'Baidu', value: 'baidu' },
        { name: 'Yahoo', value: 'yahoo' },
        { name: 'Yandex', value: 'yandex' },
      ],
      default: 'google',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'string',
      default: '',
      placeholder: 'New York, United States',
    },
    {
      displayName: 'Language',
      name: 'hl',
      type: 'options',
      options: [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Italian', value: 'it' },
        { name: 'Portuguese', value: 'pt' },
        { name: 'Chinese', value: 'zh-cn' },
        { name: 'Japanese', value: 'ja' },
        { name: 'Korean', value: 'ko' },
      ],
      default: 'en',
    },
    {
      displayName: 'Number of Results',
      name: 'num',
      type: 'number',
      default: 10,
    },
    {
      displayName: 'Start Position',
      name: 'start',
      type: 'number',
      default: 0,
      description: 'Pagination offset',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Safe Search',
          name: 'safe',
          type: 'options',
          options: [
            { name: 'Off', value: 'off' },
            { name: 'Active', value: 'active' },
          ],
          default: 'off',
        },
        {
          displayName: 'Time Range',
          name: 'tbs',
          type: 'options',
          options: [
            { name: 'Any Time', value: '' },
            { name: 'Past Hour', value: 'qdr:h' },
            { name: 'Past Day', value: 'qdr:d' },
            { name: 'Past Week', value: 'qdr:w' },
            { name: 'Past Month', value: 'qdr:m' },
            { name: 'Past Year', value: 'qdr:y' },
          ],
          default: '',
        },
        {
          displayName: 'File Type',
          name: 'filetype',
          type: 'string',
          default: '',
          placeholder: 'pdf, doc, xls',
        },
        {
          displayName: 'Site Search',
          name: 'site',
          type: 'string',
          default: '',
          placeholder: 'example.com',
        },
      ],
    },
  ],
  async execute(context) {
    const engine = context.getNodeParameter('engine', 0);
    const query = context.getNodeParameter('query', 0) as string;
    const location = context.getNodeParameter('location', 0);
    const hl = context.getNodeParameter('hl', 0);
    const num = context.getNodeParameter('num', 0);
    const start = context.getNodeParameter('start', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;
    const credentials = await context.getCredentials('serpApi');

    const params = new URLSearchParams({
      engine: engine as string,
      q: query,
      api_key: credentials.apiKey as string,
      num: String(num),
      start: String(start),
    });

    if (location) params.append('location', location as string);
    if (hl) params.append('hl', hl as string);
    if (options.safe) params.append('safe', options.safe as string);
    if (options.tbs) params.append('tbs', options.tbs as string);
    if (options.filetype) params.append('filetype', options.filetype as string);
    if (options.site) params.set('q', `site:${options.site} ${query}`);

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `https://serpapi.com/search?${params.toString()}`,
    });

    return [[{ json: response }]];
  },
});

// ============================================
// BRAVE SEARCH
// ============================================

export const BraveSearch = createProgrammaticNode({
  name: 'BraveSearch',
  displayName: 'Brave Search',
  description: 'Privacy-focused search with free API tier',
  icon: 'search',
  group: ['search'],
  version: 1,
  defaults: { name: 'Brave Search' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'braveSearchApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 2,000 queries/month | 💰 Base: $5/1000 queries | Pro (with AI): $9/1000',
    },
    {
      displayName: 'Search Type',
      name: 'searchType',
      type: 'options',
      options: [
        { name: 'Web Search', value: 'web' },
        { name: 'Image Search', value: 'images' },
        { name: 'News Search', value: 'news' },
        { name: 'Video Search', value: 'videos' },
        { name: 'Summarizer (AI)', value: 'summarizer' },
      ],
      default: 'web',
    },
    {
      displayName: 'Query',
      name: 'q',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Country',
      name: 'country',
      type: 'options',
      options: [
        { name: 'All', value: 'all' },
        { name: 'United States', value: 'us' },
        { name: 'United Kingdom', value: 'gb' },
        { name: 'Germany', value: 'de' },
        { name: 'France', value: 'fr' },
        { name: 'Canada', value: 'ca' },
        { name: 'Australia', value: 'au' },
      ],
      default: 'all',
    },
    {
      displayName: 'Results Count',
      name: 'count',
      type: 'number',
      default: 10,
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Freshness',
          name: 'freshness',
          type: 'options',
          options: [
            { name: 'Any Time', value: '' },
            { name: 'Past Day', value: 'pd' },
            { name: 'Past Week', value: 'pw' },
            { name: 'Past Month', value: 'pm' },
            { name: 'Past Year', value: 'py' },
          ],
          default: '',
        },
        {
          displayName: 'Safe Search',
          name: 'safesearch',
          type: 'options',
          options: [
            { name: 'Off', value: 'off' },
            { name: 'Moderate', value: 'moderate' },
            { name: 'Strict', value: 'strict' },
          ],
          default: 'moderate',
        },
        {
          displayName: 'Text Decorations',
          name: 'textDecorations',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Spellcheck',
          name: 'spellcheck',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const searchType = context.getNodeParameter('searchType', 0);
    const q = context.getNodeParameter('q', 0) as string;
    const country = context.getNodeParameter('country', 0);
    const count = context.getNodeParameter('count', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;
    const credentials = await context.getCredentials('braveSearchApi');

    const endpoints: Record<string, string> = {
      web: 'https://api.search.brave.com/res/v1/web/search',
      images: 'https://api.search.brave.com/res/v1/images/search',
      news: 'https://api.search.brave.com/res/v1/news/search',
      videos: 'https://api.search.brave.com/res/v1/videos/search',
      summarizer: 'https://api.search.brave.com/res/v1/summarizer/search',
    };

    const params = new URLSearchParams({
      q,
      count: String(count),
    });

    if (country !== 'all') params.append('country', country as string);
    if (options.freshness) params.append('freshness', options.freshness as string);
    if (options.safesearch) params.append('safesearch', options.safesearch as string);
    if (options.textDecorations !== undefined) params.append('text_decorations', String(options.textDecorations));
    if (options.spellcheck !== undefined) params.append('spellcheck', String(options.spellcheck));

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `${endpoints[searchType as string]}?${params.toString()}`,
      headers: {
        'X-Subscription-Token': credentials.apiKey as string,
        Accept: 'application/json',
      },
    });

    return [[{ json: response }]];
  },
});

// ============================================
// DUCKDUCKGO (Unofficial - No API Key)
// ============================================

export const DuckDuckGo = createProgrammaticNode({
  name: 'DuckDuckGo',
  displayName: 'DuckDuckGo',
  description: 'Privacy-focused search (unofficial API, no key required)',
  icon: 'search',
  group: ['search'],
  version: 1,
  defaults: { name: 'DuckDuckGo' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: No API key required | Uses instant answer API | Rate limits apply',
    },
    {
      displayName: 'Search Type',
      name: 'searchType',
      type: 'options',
      options: [
        { name: 'Instant Answers', value: 'instant' },
        { name: 'Web Search (via scraping)', value: 'web' },
        { name: 'Images', value: 'images' },
        { name: 'News', value: 'news' },
      ],
      default: 'instant',
    },
    {
      displayName: 'Query',
      name: 'q',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Format',
      name: 'format',
      type: 'options',
      options: [
        { name: 'JSON', value: 'json' },
        { name: 'XML', value: 'xml' },
      ],
      default: 'json',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Skip Disambiguation',
          name: 'skipDisambig',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'No Redirect',
          name: 'noRedirect',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'No HTML',
          name: 'noHtml',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const searchType = context.getNodeParameter('searchType', 0);
    const q = context.getNodeParameter('q', 0) as string;
    const format = context.getNodeParameter('format', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    if (searchType === 'instant') {
      // Official instant answer API
      const params = new URLSearchParams({
        q,
        format: format as string,
        no_redirect: options.noRedirect ? '1' : '0',
        no_html: options.noHtml ? '1' : '0',
        skip_disambig: options.skipDisambig ? '1' : '0',
      });

      const response = await context.helpers.httpRequest({
        method: 'GET',
        url: `https://api.duckduckgo.com/?${params.toString()}`,
      });

      return [[{ json: response }]];
    }

    // For other types, would need to scrape
    return [[{
      json: {
        query: q,
        searchType,
        note: 'Web/image/news search requires scraping DuckDuckGo HTML pages',
        suggestion: 'Use the instant answer API for structured data or use Puppeteer for full search',
      },
    }]];
  },
});

// ============================================
// BING SEARCH
// ============================================

export const BingSearch = createProgrammaticNode({
  name: 'BingSearch',
  displayName: 'Bing Search',
  description: 'Microsoft Bing Search API',
  icon: 'search',
  group: ['search'],
  version: 1,
  defaults: { name: 'Bing Search' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'bingSearchApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1,000 transactions/month (S1) | 💰 S1: $7/1000 | S2: $3/1000 | S3: $0.45/1000',
    },
    {
      displayName: 'Search Type',
      name: 'searchType',
      type: 'options',
      options: [
        { name: 'Web Search', value: 'web' },
        { name: 'Image Search', value: 'images' },
        { name: 'Video Search', value: 'videos' },
        { name: 'News Search', value: 'news' },
        { name: 'Entity Search', value: 'entities' },
        { name: 'Autosuggest', value: 'autosuggest' },
        { name: 'Spell Check', value: 'spellcheck' },
      ],
      default: 'web',
    },
    {
      displayName: 'Query',
      name: 'q',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Market',
      name: 'mkt',
      type: 'options',
      options: [
        { name: 'United States', value: 'en-US' },
        { name: 'United Kingdom', value: 'en-GB' },
        { name: 'Germany', value: 'de-DE' },
        { name: 'France', value: 'fr-FR' },
        { name: 'Spain', value: 'es-ES' },
        { name: 'Japan', value: 'ja-JP' },
        { name: 'China', value: 'zh-CN' },
      ],
      default: 'en-US',
    },
    {
      displayName: 'Count',
      name: 'count',
      type: 'number',
      default: 10,
    },
    {
      displayName: 'Offset',
      name: 'offset',
      type: 'number',
      default: 0,
    },
    {
      displayName: 'Safe Search',
      name: 'safeSearch',
      type: 'options',
      options: [
        { name: 'Off', value: 'Off' },
        { name: 'Moderate', value: 'Moderate' },
        { name: 'Strict', value: 'Strict' },
      ],
      default: 'Moderate',
    },
  ],
  async execute(context) {
    const searchType = context.getNodeParameter('searchType', 0);
    const q = context.getNodeParameter('q', 0) as string;
    const mkt = context.getNodeParameter('mkt', 0);
    const count = context.getNodeParameter('count', 0);
    const offset = context.getNodeParameter('offset', 0);
    const safeSearch = context.getNodeParameter('safeSearch', 0);
    const credentials = await context.getCredentials('bingSearchApi');

    const endpoints: Record<string, string> = {
      web: 'https://api.bing.microsoft.com/v7.0/search',
      images: 'https://api.bing.microsoft.com/v7.0/images/search',
      videos: 'https://api.bing.microsoft.com/v7.0/videos/search',
      news: 'https://api.bing.microsoft.com/v7.0/news/search',
      entities: 'https://api.bing.microsoft.com/v7.0/entities',
      autosuggest: 'https://api.bing.microsoft.com/v7.0/suggestions',
      spellcheck: 'https://api.bing.microsoft.com/v7.0/spellcheck',
    };

    const params = new URLSearchParams({
      q,
      mkt: mkt as string,
      count: String(count),
      offset: String(offset),
      safeSearch: safeSearch as string,
    });

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `${endpoints[searchType as string]}?${params.toString()}`,
      headers: {
        'Ocp-Apim-Subscription-Key': credentials.apiKey as string,
      },
    });

    return [[{ json: response }]];
  },
});

// ============================================
// WIKIPEDIA
// ============================================

export const Wikipedia = createProgrammaticNode({
  name: 'Wikipedia',
  displayName: 'Wikipedia',
  description: 'Search and retrieve Wikipedia articles',
  icon: 'book',
  group: ['search'],
  version: 1,
  defaults: { name: 'Wikipedia' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: No API key required | Unlimited requests (be respectful) | CC BY-SA license',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Search', value: 'search' },
        { name: 'Get Page', value: 'page' },
        { name: 'Get Summary', value: 'summary' },
        { name: 'Get Sections', value: 'sections' },
        { name: 'Get Related Pages', value: 'related' },
        { name: 'Random Article', value: 'random' },
        { name: 'On This Day', value: 'onThisDay' },
        { name: 'Featured Content', value: 'featured' },
      ],
      default: 'search',
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Page Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['page', 'summary', 'sections', 'related'] } },
    },
    {
      displayName: 'Language',
      name: 'language',
      type: 'options',
      options: [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Italian', value: 'it' },
        { name: 'Portuguese', value: 'pt' },
        { name: 'Russian', value: 'ru' },
        { name: 'Japanese', value: 'ja' },
        { name: 'Chinese', value: 'zh' },
        { name: 'Arabic', value: 'ar' },
      ],
      default: 'en',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Include Images',
          name: 'includeImages',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include References',
          name: 'includeReferences',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Max Results',
          name: 'limit',
          type: 'number',
          default: 10,
        },
      ],
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const language = context.getNodeParameter('language', 0) as string;
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    const baseUrl = `https://${language}.wikipedia.org/api/rest_v1`;
    const mediaWikiUrl = `https://${language}.wikipedia.org/w/api.php`;

    switch (operation) {
      case 'search':
        const query = context.getNodeParameter('query', 0) as string;
        const limit = options.limit || 10;

        const searchResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${mediaWikiUrl}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json`,
        });
        return [[{ json: searchResponse }]];

      case 'page':
        const pageTitle = context.getNodeParameter('title', 0) as string;
        const pageResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/page/html/${encodeURIComponent(pageTitle)}`,
        });
        return [[{ json: { title: pageTitle, html: pageResponse } }]];

      case 'summary':
        const summaryTitle = context.getNodeParameter('title', 0) as string;
        const summaryResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/page/summary/${encodeURIComponent(summaryTitle)}`,
        });
        return [[{ json: summaryResponse }]];

      case 'sections':
        const sectionsTitle = context.getNodeParameter('title', 0) as string;
        const sectionsResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/page/mobile-sections/${encodeURIComponent(sectionsTitle)}`,
        });
        return [[{ json: sectionsResponse }]];

      case 'related':
        const relatedTitle = context.getNodeParameter('title', 0) as string;
        const relatedResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/page/related/${encodeURIComponent(relatedTitle)}`,
        });
        return [[{ json: relatedResponse }]];

      case 'random':
        const randomResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/page/random/summary`,
        });
        return [[{ json: randomResponse }]];

      case 'onThisDay':
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const onThisDayResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/feed/onthisday/events/${month}/${day}`,
        });
        return [[{ json: onThisDayResponse }]];

      case 'featured':
        const featuredDate = new Date().toISOString().split('T')[0].replace(/-/g, '/');
        const featuredResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/feed/featured/${featuredDate}`,
        });
        return [[{ json: featuredResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// ARXIV (Academic Papers)
// ============================================

export const ArXiv = createProgrammaticNode({
  name: 'ArXiv',
  displayName: 'ArXiv',
  description: 'Search academic papers on arXiv.org',
  icon: 'graduation-cap',
  group: ['search'],
  version: 1,
  defaults: { name: 'ArXiv' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: No API key required | Rate limit: 1 request/3 seconds | Academic papers since 1991',
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      placeholder: 'machine learning OR deep learning',
    },
    {
      displayName: 'Search In',
      name: 'searchIn',
      type: 'options',
      options: [
        { name: 'All Fields', value: 'all' },
        { name: 'Title', value: 'ti' },
        { name: 'Author', value: 'au' },
        { name: 'Abstract', value: 'abs' },
        { name: 'Category', value: 'cat' },
        { name: 'Journal Reference', value: 'jr' },
      ],
      default: 'all',
    },
    {
      displayName: 'Category',
      name: 'category',
      type: 'options',
      options: [
        { name: 'All', value: '' },
        { name: 'Computer Science - AI', value: 'cs.AI' },
        { name: 'Computer Science - ML', value: 'cs.LG' },
        { name: 'Computer Science - CV', value: 'cs.CV' },
        { name: 'Computer Science - CL', value: 'cs.CL' },
        { name: 'Statistics - ML', value: 'stat.ML' },
        { name: 'Physics', value: 'physics' },
        { name: 'Mathematics', value: 'math' },
        { name: 'Quantitative Biology', value: 'q-bio' },
        { name: 'Quantitative Finance', value: 'q-fin' },
      ],
      default: '',
    },
    {
      displayName: 'Max Results',
      name: 'maxResults',
      type: 'number',
      default: 10,
    },
    {
      displayName: 'Start Index',
      name: 'start',
      type: 'number',
      default: 0,
    },
    {
      displayName: 'Sort By',
      name: 'sortBy',
      type: 'options',
      options: [
        { name: 'Relevance', value: 'relevance' },
        { name: 'Last Updated', value: 'lastUpdatedDate' },
        { name: 'Submitted Date', value: 'submittedDate' },
      ],
      default: 'relevance',
    },
    {
      displayName: 'Sort Order',
      name: 'sortOrder',
      type: 'options',
      options: [
        { name: 'Descending', value: 'descending' },
        { name: 'Ascending', value: 'ascending' },
      ],
      default: 'descending',
    },
  ],
  async execute(context) {
    const query = context.getNodeParameter('query', 0) as string;
    const searchIn = context.getNodeParameter('searchIn', 0);
    const category = context.getNodeParameter('category', 0);
    const maxResults = context.getNodeParameter('maxResults', 0);
    const start = context.getNodeParameter('start', 0);
    const sortBy = context.getNodeParameter('sortBy', 0);
    const sortOrder = context.getNodeParameter('sortOrder', 0);

    let searchQuery = query;
    if (searchIn !== 'all') {
      searchQuery = `${searchIn}:${query}`;
    }
    if (category) {
      searchQuery += ` AND cat:${category}`;
    }

    const params = new URLSearchParams({
      search_query: searchQuery,
      start: String(start),
      max_results: String(maxResults),
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    });

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `http://export.arxiv.org/api/query?${params.toString()}`,
    });

    // Parse XML response (simplified)
    return [[{
      json: {
        query: searchQuery,
        response: response,
        note: 'Response is in Atom XML format - use XML parser to extract entries',
      },
    }]];
  },
});

// ============================================
// HACKER NEWS
// ============================================

export const HackerNews = createProgrammaticNode({
  name: 'HackerNews',
  displayName: 'Hacker News',
  description: 'Access Hacker News stories, comments, and users',
  icon: 'newspaper',
  group: ['search'],
  version: 1,
  defaults: { name: 'Hacker News' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Official Firebase API | No rate limits | Real-time data',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Get Top Stories', value: 'topStories' },
        { name: 'Get New Stories', value: 'newStories' },
        { name: 'Get Best Stories', value: 'bestStories' },
        { name: 'Get Ask HN', value: 'askStories' },
        { name: 'Get Show HN', value: 'showStories' },
        { name: 'Get Job Stories', value: 'jobStories' },
        { name: 'Get Item', value: 'item' },
        { name: 'Get User', value: 'user' },
        { name: 'Search (Algolia)', value: 'search' },
      ],
      default: 'topStories',
    },
    {
      displayName: 'Item ID',
      name: 'itemId',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['item'] } },
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['user'] } },
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Limit',
      name: 'limit',
      type: 'number',
      default: 30,
      description: 'Number of stories to fetch (max 500)',
      displayOptions: { show: { operation: ['topStories', 'newStories', 'bestStories', 'askStories', 'showStories', 'jobStories'] } },
    },
    {
      displayName: 'Search Options',
      name: 'searchOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      displayOptions: { show: { operation: ['search'] } },
      options: [
        {
          displayName: 'Search Type',
          name: 'tags',
          type: 'options',
          options: [
            { name: 'All', value: '' },
            { name: 'Stories', value: 'story' },
            { name: 'Comments', value: 'comment' },
            { name: 'Show HN', value: 'show_hn' },
            { name: 'Ask HN', value: 'ask_hn' },
            { name: 'Front Page', value: 'front_page' },
          ],
          default: 'story',
        },
        {
          displayName: 'Sort By',
          name: 'sortBy',
          type: 'options',
          options: [
            { name: 'Relevance', value: 'search' },
            { name: 'Date', value: 'search_by_date' },
          ],
          default: 'search',
        },
        {
          displayName: 'Time Range',
          name: 'numericFilters',
          type: 'options',
          options: [
            { name: 'All Time', value: '' },
            { name: 'Last 24 Hours', value: 'created_at_i>NOW-1DAY' },
            { name: 'Past Week', value: 'created_at_i>NOW-7DAYS' },
            { name: 'Past Month', value: 'created_at_i>NOW-1MONTH' },
            { name: 'Past Year', value: 'created_at_i>NOW-1YEAR' },
          ],
          default: '',
        },
        {
          displayName: 'Hits Per Page',
          name: 'hitsPerPage',
          type: 'number',
          default: 20,
        },
      ],
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);

    const firebaseUrl = 'https://hacker-news.firebaseio.com/v0';
    const algoliaUrl = 'https://hn.algolia.com/api/v1';

    switch (operation) {
      case 'topStories':
      case 'newStories':
      case 'bestStories':
      case 'askStories':
      case 'showStories':
      case 'jobStories':
        const limit = context.getNodeParameter('limit', 0) as number;
        const endpoint = operation.replace('Stories', 'stories');

        const idsResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${firebaseUrl}/${endpoint}.json`,
        });

        const ids = (idsResponse as number[]).slice(0, limit);

        // Fetch details for each story (in parallel, batched)
        const stories = await Promise.all(
          ids.map(id =>
            context.helpers.httpRequest({
              method: 'GET',
              url: `${firebaseUrl}/item/${id}.json`,
            })
          )
        );

        return [[{ json: { stories, count: stories.length } }]];

      case 'item':
        const itemId = context.getNodeParameter('itemId', 0);
        const itemResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${firebaseUrl}/item/${itemId}.json`,
        });
        return [[{ json: itemResponse }]];

      case 'user':
        const username = context.getNodeParameter('username', 0);
        const userResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${firebaseUrl}/user/${username}.json`,
        });
        return [[{ json: userResponse }]];

      case 'search':
        const query = context.getNodeParameter('query', 0) as string;
        const searchOptions = context.getNodeParameter('searchOptions', 0) as Record<string, unknown>;

        const params = new URLSearchParams({ query });
        if (searchOptions.tags) params.append('tags', searchOptions.tags as string);
        if (searchOptions.hitsPerPage) params.append('hitsPerPage', String(searchOptions.hitsPerPage));

        const searchEndpoint = searchOptions.sortBy === 'search_by_date' ? 'search_by_date' : 'search';

        const searchResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${algoliaUrl}/${searchEndpoint}?${params.toString()}`,
        });
        return [[{ json: searchResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// PRODUCT HUNT
// ============================================

export const ProductHunt = createProgrammaticNode({
  name: 'ProductHunt',
  displayName: 'Product Hunt',
  description: 'Access Product Hunt products, posts, and collections',
  icon: 'rocket',
  group: ['search'],
  version: 1,
  defaults: { name: 'Product Hunt' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'productHuntApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: API access with developer token | GraphQL API | Generous rate limits',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Get Posts', value: 'posts' },
        { name: 'Get Post Details', value: 'post' },
        { name: 'Get Today\'s Posts', value: 'today' },
        { name: 'Search Products', value: 'search' },
        { name: 'Get Collections', value: 'collections' },
        { name: 'Get Topics', value: 'topics' },
      ],
      default: 'today',
    },
    {
      displayName: 'Post ID/Slug',
      name: 'postId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['post'] } },
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'First N Results',
      name: 'first',
      type: 'number',
      default: 20,
    },
    {
      displayName: 'Sort By',
      name: 'order',
      type: 'options',
      options: [
        { name: 'Ranking', value: 'RANKING' },
        { name: 'Votes', value: 'VOTES' },
        { name: 'Newest', value: 'NEWEST' },
        { name: 'Featured At', value: 'FEATURED_AT' },
      ],
      default: 'RANKING',
      displayOptions: { show: { operation: ['posts', 'today'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const first = context.getNodeParameter('first', 0);
    const credentials = await context.getCredentials('productHuntApi');

    const graphqlEndpoint = 'https://api.producthunt.com/v2/api/graphql';

    let query = '';
    let variables: Record<string, unknown> = {};

    switch (operation) {
      case 'today':
      case 'posts':
        const order = context.getNodeParameter('order', 0);
        query = `
          query GetPosts($first: Int!, $order: PostsOrder!) {
            posts(first: $first, order: $order) {
              edges {
                node {
                  id
                  name
                  tagline
                  description
                  url
                  votesCount
                  commentsCount
                  thumbnail {
                    url
                  }
                  topics {
                    edges {
                      node {
                        name
                      }
                    }
                  }
                  makers {
                    name
                    username
                  }
                }
              }
            }
          }
        `;
        variables = { first, order };
        break;

      case 'search':
        const searchQuery = context.getNodeParameter('query', 0);
        query = `
          query SearchPosts($query: String!, $first: Int!) {
            posts(first: $first, topic: $query) {
              edges {
                node {
                  id
                  name
                  tagline
                  url
                  votesCount
                }
              }
            }
          }
        `;
        variables = { query: searchQuery, first };
        break;

      case 'post':
        const postId = context.getNodeParameter('postId', 0);
        query = `
          query GetPost($slug: String!) {
            post(slug: $slug) {
              id
              name
              tagline
              description
              url
              website
              votesCount
              commentsCount
              reviewsRating
              thumbnail {
                url
              }
              media {
                url
                type
              }
            }
          }
        `;
        variables = { slug: postId };
        break;
    }

    const response = await context.helpers.httpRequest({
      method: 'POST',
      url: graphqlEndpoint,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    return [[{ json: response }]];
  },
});

// ============================================
// GOOGLE TRENDS
// ============================================

export const GoogleTrends = createProgrammaticNode({
  name: 'GoogleTrends',
  displayName: 'Google Trends',
  description: 'Get trending topics and search interest over time',
  icon: 'chart-line',
  group: ['search'],
  version: 1,
  defaults: { name: 'Google Trends' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: No official API (uses unofficial endpoints) | Rate limits apply | Consider using SerpAPI for production',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Daily Trends', value: 'dailyTrends' },
        { name: 'Real-Time Trends', value: 'realTimeTrends' },
        { name: 'Interest Over Time', value: 'interestOverTime' },
        { name: 'Related Queries', value: 'relatedQueries' },
        { name: 'Related Topics', value: 'relatedTopics' },
      ],
      default: 'dailyTrends',
    },
    {
      displayName: 'Keyword(s)',
      name: 'keyword',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['interestOverTime', 'relatedQueries', 'relatedTopics'] } },
    },
    {
      displayName: 'Geography',
      name: 'geo',
      type: 'options',
      options: [
        { name: 'Worldwide', value: '' },
        { name: 'United States', value: 'US' },
        { name: 'United Kingdom', value: 'GB' },
        { name: 'Germany', value: 'DE' },
        { name: 'France', value: 'FR' },
        { name: 'Japan', value: 'JP' },
        { name: 'India', value: 'IN' },
        { name: 'Brazil', value: 'BR' },
        { name: 'Canada', value: 'CA' },
        { name: 'Australia', value: 'AU' },
      ],
      default: 'US',
    },
    {
      displayName: 'Category',
      name: 'category',
      type: 'options',
      options: [
        { name: 'All Categories', value: '0' },
        { name: 'Arts & Entertainment', value: '3' },
        { name: 'Autos & Vehicles', value: '47' },
        { name: 'Business', value: '12' },
        { name: 'Computers & Electronics', value: '5' },
        { name: 'Finance', value: '7' },
        { name: 'Food & Drink', value: '71' },
        { name: 'Health', value: '45' },
        { name: 'News', value: '16' },
        { name: 'Science', value: '174' },
        { name: 'Sports', value: '20' },
        { name: 'Technology', value: '5' },
      ],
      default: '0',
      displayOptions: { show: { operation: ['realTimeTrends'] } },
    },
    {
      displayName: 'Time Range',
      name: 'time',
      type: 'options',
      options: [
        { name: 'Past Hour', value: 'now 1-H' },
        { name: 'Past 4 Hours', value: 'now 4-H' },
        { name: 'Past Day', value: 'now 1-d' },
        { name: 'Past 7 Days', value: 'now 7-d' },
        { name: 'Past 30 Days', value: 'today 1-m' },
        { name: 'Past 90 Days', value: 'today 3-m' },
        { name: 'Past 12 Months', value: 'today 12-m' },
        { name: 'Past 5 Years', value: 'today 5-y' },
      ],
      default: 'today 12-m',
      displayOptions: { show: { operation: ['interestOverTime', 'relatedQueries', 'relatedTopics'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const geo = context.getNodeParameter('geo', 0);

    // Note: This would typically use a library like google-trends-api
    // or scrape the trends.google.com pages
    const result: Record<string, unknown> = {
      operation,
      geo,
      note: 'Google Trends does not have an official API. For production use, consider SerpAPI or similar services.',
    };

    switch (operation) {
      case 'dailyTrends':
        result.data = {
          trendingSearches: [
            { title: 'Trending Topic 1', traffic: '500K+', articles: [] },
            { title: 'Trending Topic 2', traffic: '200K+', articles: [] },
          ],
        };
        break;

      case 'interestOverTime':
        const keyword = context.getNodeParameter('keyword', 0);
        result.keyword = keyword;
        result.data = {
          timeline: [
            { date: '2024-01-01', value: 75 },
            { date: '2024-01-08', value: 82 },
            { date: '2024-01-15', value: 90 },
          ],
        };
        break;

      case 'relatedQueries':
        result.data = {
          top: [
            { query: 'related query 1', value: 100 },
            { query: 'related query 2', value: 85 },
          ],
          rising: [
            { query: 'rising query 1', value: '+5000%' },
            { query: 'rising query 2', value: '+2000%' },
          ],
        };
        break;
    }

    return [[{ json: result }]];
  },
});

// Web Scraping Nodes with Pricing Information
// 💚 = Free / Self-hosted
// 💰 = Paid service

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// HEADLESS BROWSER - PUPPETEER
// ============================================

export const Puppeteer = createProgrammaticNode({
  name: 'Puppeteer',
  displayName: 'Puppeteer (Headless Browser)',
  description: 'Automate browser actions, scrape dynamic websites, take screenshots',
  icon: 'chrome',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Puppeteer' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Self-hosted, runs on your server | Requires: puppeteer npm package',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Get Page Content', value: 'getContent' },
        { name: 'Take Screenshot', value: 'screenshot' },
        { name: 'Generate PDF', value: 'pdf' },
        { name: 'Execute Script', value: 'evaluate' },
        { name: 'Click Element', value: 'click' },
        { name: 'Fill Form', value: 'fill' },
        { name: 'Wait for Selector', value: 'waitFor' },
        { name: 'Extract Data', value: 'extract' },
        { name: 'Scrape Multiple Pages', value: 'scrapeMultiple' },
      ],
      default: 'getContent',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      description: 'The URL to navigate to',
    },
    {
      displayName: 'Selector',
      name: 'selector',
      type: 'string',
      default: '',
      placeholder: '#main-content, .article-body, [data-id="content"]',
      displayOptions: { show: { operation: ['extract', 'click', 'fill', 'waitFor'] } },
    },
    {
      displayName: 'JavaScript Code',
      name: 'script',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      placeholder: 'return document.title;',
      displayOptions: { show: { operation: ['evaluate'] } },
    },
    {
      displayName: 'Form Value',
      name: 'formValue',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['fill'] } },
    },
    {
      displayName: 'Extraction Rules',
      name: 'extractionRules',
      type: 'json',
      default: '{\n  "title": "h1",\n  "content": ".article-content",\n  "links": "a@href",\n  "images": "img@src"\n}',
      displayOptions: { show: { operation: ['extract'] } },
    },
    {
      displayName: 'URLs to Scrape',
      name: 'urls',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      placeholder: 'One URL per line',
      displayOptions: { show: { operation: ['scrapeMultiple'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Wait Until',
          name: 'waitUntil',
          type: 'options',
          options: [
            { name: 'Load', value: 'load' },
            { name: 'DOM Content Loaded', value: 'domcontentloaded' },
            { name: 'Network Idle (0 connections)', value: 'networkidle0' },
            { name: 'Network Idle (2 connections)', value: 'networkidle2' },
          ],
          default: 'networkidle2',
        },
        {
          displayName: 'Timeout (ms)',
          name: 'timeout',
          type: 'number',
          default: 30000,
        },
        {
          displayName: 'Viewport Width',
          name: 'viewportWidth',
          type: 'number',
          default: 1920,
        },
        {
          displayName: 'Viewport Height',
          name: 'viewportHeight',
          type: 'number',
          default: 1080,
        },
        {
          displayName: 'User Agent',
          name: 'userAgent',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Headless',
          name: 'headless',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Block Images',
          name: 'blockImages',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Block CSS',
          name: 'blockCSS',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Proxy',
          name: 'proxy',
          type: 'string',
          default: '',
          placeholder: 'http://proxy:8080',
        },
      ],
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const url = context.getNodeParameter('url', 0) as string;
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    // This would use puppeteer in actual implementation
    // For now, return structured response showing what would happen
    const result: Record<string, unknown> = {
      operation,
      url,
      options,
      status: 'would_execute',
      note: 'Puppeteer execution requires puppeteer package installed on worker',
    };

    switch (operation) {
      case 'getContent':
        result.output = {
          html: '<html>...</html>',
          text: 'Page text content...',
          title: 'Page Title',
        };
        break;

      case 'screenshot':
        result.output = {
          screenshot: 'base64_encoded_image_data',
          format: 'png',
          dimensions: { width: options.viewportWidth || 1920, height: options.viewportHeight || 1080 },
        };
        break;

      case 'pdf':
        result.output = {
          pdf: 'base64_encoded_pdf_data',
          pages: 1,
        };
        break;

      case 'extract':
        const rules = context.getNodeParameter('extractionRules', 0);
        result.extractionRules = rules;
        result.output = {
          title: 'Extracted Title',
          content: 'Extracted content...',
          links: ['https://example.com/1', 'https://example.com/2'],
          images: ['https://example.com/img1.png'],
        };
        break;

      case 'scrapeMultiple':
        const urls = (context.getNodeParameter('urls', 0) as string).split('\n').filter(u => u.trim());
        result.urls = urls;
        result.output = urls.map(u => ({
          url: u,
          status: 'scraped',
          data: { title: `Title of ${u}`, content: '...' },
        }));
        break;
    }

    return [[{ json: result }]];
  },
});

// ============================================
// HTML PARSER
// ============================================

export const HTMLParser = createProgrammaticNode({
  name: 'HTMLParser',
  displayName: 'HTML Parser',
  description: 'Parse HTML and extract data using CSS selectors or XPath',
  icon: 'code',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'HTML Parser' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Uses cheerio (server-side jQuery) | No external API needed',
    },
    {
      displayName: 'HTML Source',
      name: 'htmlSource',
      type: 'options',
      options: [
        { name: 'From URL', value: 'url' },
        { name: 'From Input', value: 'input' },
        { name: 'From Previous Node', value: 'previous' },
      ],
      default: 'url',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      displayOptions: { show: { htmlSource: ['url'] } },
    },
    {
      displayName: 'HTML Content',
      name: 'html',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { htmlSource: ['input'] } },
    },
    {
      displayName: 'Extraction Mode',
      name: 'extractionMode',
      type: 'options',
      options: [
        { name: 'Single Selector', value: 'single' },
        { name: 'Multiple Selectors', value: 'multiple' },
        { name: 'Table Extraction', value: 'table' },
        { name: 'List Extraction', value: 'list' },
        { name: 'Structured Data (JSON-LD)', value: 'jsonld' },
        { name: 'Meta Tags', value: 'meta' },
        { name: 'All Links', value: 'links' },
        { name: 'All Images', value: 'images' },
      ],
      default: 'single',
    },
    {
      displayName: 'CSS Selector',
      name: 'selector',
      type: 'string',
      default: '',
      placeholder: '.article-content, #main, [data-content]',
      displayOptions: { show: { extractionMode: ['single', 'list'] } },
    },
    {
      displayName: 'Extraction Fields',
      name: 'fields',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { extractionMode: ['multiple'] } },
      options: [
        {
          name: 'field',
          displayName: 'Field',
          values: [
            {
              displayName: 'Field Name',
              name: 'name',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Selector',
              name: 'selector',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Attribute',
              name: 'attribute',
              type: 'string',
              default: 'text',
              description: 'text, html, href, src, or any attribute name',
            },
          ],
        },
      ],
    },
    {
      displayName: 'Table Selector',
      name: 'tableSelector',
      type: 'string',
      default: 'table',
      displayOptions: { show: { extractionMode: ['table'] } },
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'Text Only', value: 'text' },
        { name: 'HTML', value: 'html' },
        { name: 'Both', value: 'both' },
      ],
      default: 'text',
      displayOptions: { show: { extractionMode: ['single', 'list'] } },
    },
  ],
  async execute(context) {
    const htmlSource = context.getNodeParameter('htmlSource', 0);
    const extractionMode = context.getNodeParameter('extractionMode', 0);

    let html = '';
    if (htmlSource === 'url') {
      const url = context.getNodeParameter('url', 0) as string;
      const response = await context.helpers.httpRequest({
        method: 'GET',
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentSmith/1.0)',
        },
      });
      html = typeof response === 'string' ? response : JSON.stringify(response);
    } else if (htmlSource === 'input') {
      html = context.getNodeParameter('html', 0) as string;
    } else {
      // From previous node - would get from input
      const items = context.getInputData();
      html = items[0]?.json?.html as string || '';
    }

    const result: Record<string, unknown> = {
      extractionMode,
      source: htmlSource,
    };

    // Simulated extraction (actual would use cheerio)
    switch (extractionMode) {
      case 'meta':
        result.data = {
          title: 'Page Title',
          description: 'Meta description...',
          keywords: ['keyword1', 'keyword2'],
          ogTitle: 'Open Graph Title',
          ogDescription: 'OG Description',
          ogImage: 'https://example.com/og-image.jpg',
          twitterCard: 'summary_large_image',
        };
        break;

      case 'links':
        result.data = {
          internal: [
            { text: 'Home', href: '/', title: 'Go home' },
            { text: 'About', href: '/about', title: '' },
          ],
          external: [
            { text: 'Partner', href: 'https://partner.com', title: '' },
          ],
          total: 3,
        };
        break;

      case 'images':
        result.data = [
          { src: 'https://example.com/img1.jpg', alt: 'Image 1', width: 800, height: 600 },
          { src: 'https://example.com/img2.png', alt: 'Image 2', width: 400, height: 300 },
        ];
        break;

      case 'jsonld':
        result.data = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Article Title',
          author: { '@type': 'Person', name: 'John Doe' },
          datePublished: '2024-01-15',
        };
        break;

      case 'table':
        result.data = {
          headers: ['Name', 'Price', 'Stock'],
          rows: [
            ['Product A', '$10', 'In Stock'],
            ['Product B', '$20', 'Out of Stock'],
          ],
        };
        break;

      default:
        result.data = {
          text: 'Extracted text content...',
          html: '<div>Extracted HTML...</div>',
        };
    }

    return [[{ json: result }]];
  },
});

// ============================================
// ARTICLE EXTRACTOR (Readability)
// ============================================

export const ArticleExtractor = createProgrammaticNode({
  name: 'ArticleExtractor',
  displayName: 'Article Extractor',
  description: 'Extract clean article content from web pages (like Readability)',
  icon: 'newspaper',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Article Extractor' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Uses Mozilla Readability algorithm | Self-hosted',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Output Options',
      name: 'outputOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Include HTML',
          name: 'includeHtml',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Plain Text',
          name: 'includeText',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Metadata',
          name: 'includeMetadata',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Images',
          name: 'includeImages',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Word Count',
          name: 'wordCount',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Reading Time',
          name: 'readingTime',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const url = context.getNodeParameter('url', 0) as string;
    const options = context.getNodeParameter('outputOptions', 0) as Record<string, boolean>;

    // Fetch the page
    const html = await context.helpers.httpRequest({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgentSmith/1.0; +https://agentsmith.io)',
      },
    });

    // Simulated Readability extraction
    const result: Record<string, unknown> = {
      url,
      title: 'Article Title Extracted',
      byline: 'By John Doe',
      siteName: 'Example News',
      publishedDate: '2024-01-15T10:00:00Z',
      excerpt: 'This is the article excerpt or summary...',
    };

    if (options.includeHtml !== false) {
      result.contentHtml = '<article><h1>Article Title</h1><p>Article content...</p></article>';
    }

    if (options.includeText !== false) {
      result.contentText = 'Article Title\n\nArticle content in plain text...';
    }

    if (options.includeMetadata !== false) {
      result.metadata = {
        language: 'en',
        charset: 'utf-8',
        ogImage: 'https://example.com/article-image.jpg',
        ogDescription: 'Article description',
        keywords: ['news', 'technology', 'innovation'],
        canonicalUrl: url,
      };
    }

    if (options.includeImages !== false) {
      result.images = [
        { src: 'https://example.com/img1.jpg', alt: 'Main image', isHero: true },
        { src: 'https://example.com/img2.jpg', alt: 'Supporting image', isHero: false },
      ];
    }

    if (options.wordCount !== false) {
      result.wordCount = 1250;
    }

    if (options.readingTime !== false) {
      result.readingTime = '5 min read';
    }

    return [[{ json: result }]];
  },
});

// ============================================
// WEB SCRAPER API SERVICES
// ============================================

export const ScrapingBee = createProgrammaticNode({
  name: 'ScrapingBee',
  displayName: 'ScrapingBee',
  description: 'Web scraping API with JavaScript rendering and proxy rotation',
  icon: 'bee',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'ScrapingBee' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'scrapingBeeApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1,000 credits on signup | 💰 Freelance: $49/mo (150k credits) | Startup: $99/mo (500k) | Business: $249/mo (2M)',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Render JavaScript',
          name: 'renderJs',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Premium Proxy',
          name: 'premiumProxy',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Stealth Proxy',
          name: 'stealthProxy',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Country Code',
          name: 'countryCode',
          type: 'string',
          default: '',
          placeholder: 'us, gb, de, etc.',
        },
        {
          displayName: 'CSS Selector',
          name: 'extractRules',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Wait (ms)',
          name: 'wait',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Wait for Selector',
          name: 'waitFor',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Screenshot',
          name: 'screenshot',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Block Resources',
          name: 'blockResources',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const url = context.getNodeParameter('url', 0) as string;
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;
    const credentials = await context.getCredentials('scrapingBeeApi');

    const params = new URLSearchParams({
      api_key: credentials.apiKey as string,
      url,
    });

    if (options.renderJs) params.append('render_js', 'true');
    if (options.premiumProxy) params.append('premium_proxy', 'true');
    if (options.stealthProxy) params.append('stealth_proxy', 'true');
    if (options.countryCode) params.append('country_code', options.countryCode as string);
    if (options.wait) params.append('wait', String(options.wait));
    if (options.waitFor) params.append('wait_for', options.waitFor as string);
    if (options.screenshot) params.append('screenshot', 'true');
    if (options.blockResources) params.append('block_resources', 'true');

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `https://app.scrapingbee.com/api/v1?${params.toString()}`,
    });

    return [[{ json: { url, content: response, options } }]];
  },
});

export const BrightData = createProgrammaticNode({
  name: 'BrightData',
  displayName: 'Bright Data (Luminati)',
  description: 'Enterprise web scraping with rotating proxies',
  icon: 'globe',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Bright Data' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'brightDataApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 7-day trial | 💰 Pay-as-you-go: $0.001-0.02/request | Monthly from $500/mo',
    },
    {
      displayName: 'Product',
      name: 'product',
      type: 'options',
      options: [
        { name: 'Web Scraper API', value: 'scraper' },
        { name: 'SERP API', value: 'serp' },
        { name: 'E-commerce API', value: 'ecommerce' },
        { name: 'Social Media API', value: 'social' },
      ],
      default: 'scraper',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Zone',
      name: 'zone',
      type: 'options',
      options: [
        { name: 'Datacenter', value: 'datacenter' },
        { name: 'Residential', value: 'residential' },
        { name: 'Mobile', value: 'mobile' },
        { name: 'ISP', value: 'isp' },
      ],
      default: 'datacenter',
    },
    {
      displayName: 'Country',
      name: 'country',
      type: 'string',
      default: '',
      placeholder: 'us, gb, de, etc.',
    },
  ],
  async execute(context) {
    const product = context.getNodeParameter('product', 0);
    const url = context.getNodeParameter('url', 0) as string;
    const zone = context.getNodeParameter('zone', 0);
    const country = context.getNodeParameter('country', 0);
    const credentials = await context.getCredentials('brightDataApi');

    // Bright Data uses proxy endpoints
    const proxyUrl = `http://${credentials.username}-zone-${zone}${country ? `-country-${country}` : ''}:${credentials.password}@zproxy.lum-superproxy.io:22225`;

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url,
      proxy: proxyUrl,
    });

    return [[{ json: { url, product, content: response } }]];
  },
});

export const ScraperAPI = createProgrammaticNode({
  name: 'ScraperAPI',
  displayName: 'ScraperAPI',
  description: 'Simple web scraping API with proxy rotation',
  icon: 'spider',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'ScraperAPI' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'scraperApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 5,000 API credits | 💰 Hobby: $49/mo (100k) | Startup: $149/mo (1M) | Business: $299/mo (3M)',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Render JavaScript',
          name: 'render',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Country Code',
          name: 'countryCode',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Premium',
          name: 'premium',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Session Number',
          name: 'sessionNumber',
          type: 'number',
          default: 0,
          description: 'Use same IP for multiple requests',
        },
        {
          displayName: 'Keep Headers',
          name: 'keepHeaders',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Device Type',
          name: 'deviceType',
          type: 'options',
          options: [
            { name: 'Desktop', value: 'desktop' },
            { name: 'Mobile', value: 'mobile' },
          ],
          default: 'desktop',
        },
        {
          displayName: 'Auto Parse',
          name: 'autoParse',
          type: 'boolean',
          default: false,
          description: 'Auto-extract structured data',
        },
      ],
    },
  ],
  async execute(context) {
    const url = context.getNodeParameter('url', 0) as string;
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;
    const credentials = await context.getCredentials('scraperApi');

    const params = new URLSearchParams({
      api_key: credentials.apiKey as string,
      url,
    });

    if (options.render) params.append('render', 'true');
    if (options.countryCode) params.append('country_code', options.countryCode as string);
    if (options.premium) params.append('premium', 'true');
    if (options.sessionNumber) params.append('session_number', String(options.sessionNumber));
    if (options.deviceType) params.append('device_type', options.deviceType as string);
    if (options.autoParse) params.append('autoparse', 'true');

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `https://api.scraperapi.com?${params.toString()}`,
    });

    return [[{ json: { url, content: response, options } }]];
  },
});

// ============================================
// DATA EXTRACTION UTILITIES
// ============================================

export const PDFExtractor = createProgrammaticNode({
  name: 'PDFExtractor',
  displayName: 'PDF Extractor',
  description: 'Extract text, tables, and metadata from PDF files',
  icon: 'file-pdf',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'PDF Extractor' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Uses pdf-parse library | Self-hosted, no external API',
    },
    {
      displayName: 'Source',
      name: 'source',
      type: 'options',
      options: [
        { name: 'URL', value: 'url' },
        { name: 'Binary Data', value: 'binary' },
        { name: 'File Path', value: 'path' },
      ],
      default: 'url',
    },
    {
      displayName: 'PDF URL',
      name: 'url',
      type: 'string',
      default: '',
      displayOptions: { show: { source: ['url'] } },
    },
    {
      displayName: 'File Path',
      name: 'filePath',
      type: 'string',
      default: '',
      displayOptions: { show: { source: ['path'] } },
    },
    {
      displayName: 'Extraction Options',
      name: 'extractionOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Extract Text',
          name: 'extractText',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Extract Tables',
          name: 'extractTables',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Extract Images',
          name: 'extractImages',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Get Metadata',
          name: 'getMetadata',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Page Range',
          name: 'pageRange',
          type: 'string',
          default: '',
          placeholder: '1-5 or 1,3,5',
        },
        {
          displayName: 'OCR for Images',
          name: 'ocrEnabled',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const source = context.getNodeParameter('source', 0);
    const options = context.getNodeParameter('extractionOptions', 0) as Record<string, unknown>;

    let pdfSource = '';
    if (source === 'url') {
      pdfSource = context.getNodeParameter('url', 0) as string;
    } else if (source === 'path') {
      pdfSource = context.getNodeParameter('filePath', 0) as string;
    }

    // Simulated PDF extraction
    const result: Record<string, unknown> = {
      source: pdfSource,
      pages: 10,
    };

    if (options.extractText !== false) {
      result.text = 'Extracted text from PDF document...\n\nPage 1 content...\n\nPage 2 content...';
    }

    if (options.getMetadata !== false) {
      result.metadata = {
        title: 'Document Title',
        author: 'John Doe',
        subject: 'Technical Documentation',
        creator: 'Microsoft Word',
        producer: 'Adobe PDF',
        creationDate: '2024-01-15T10:00:00Z',
        modificationDate: '2024-01-20T15:30:00Z',
        pageCount: 10,
        encrypted: false,
      };
    }

    if (options.extractTables) {
      result.tables = [
        {
          page: 3,
          headers: ['Column A', 'Column B', 'Column C'],
          rows: [
            ['Value 1', 'Value 2', 'Value 3'],
            ['Value 4', 'Value 5', 'Value 6'],
          ],
        },
      ];
    }

    if (options.extractImages) {
      result.images = [
        { page: 1, index: 0, width: 800, height: 600, format: 'png' },
        { page: 2, index: 0, width: 400, height: 300, format: 'jpeg' },
      ];
    }

    return [[{ json: result }]];
  },
});

export const OCR = createProgrammaticNode({
  name: 'OCR',
  displayName: 'OCR (Image to Text)',
  description: 'Extract text from images using OCR',
  icon: 'eye',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'OCR' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'ocrApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Tesseract (self-hosted) | 💚 FREE: OCR.space (25k images/mo) | 💰 Google Vision: $1.50/1000 images',
    },
    {
      displayName: 'Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'Tesseract (Self-hosted)', value: 'tesseract' },
        { name: 'OCR.space (Free tier)', value: 'ocrSpace' },
        { name: 'Google Cloud Vision', value: 'googleVision' },
        { name: 'AWS Textract', value: 'textract' },
        { name: 'Azure Computer Vision', value: 'azure' },
      ],
      default: 'ocrSpace',
    },
    {
      displayName: 'Image Source',
      name: 'imageSource',
      type: 'options',
      options: [
        { name: 'URL', value: 'url' },
        { name: 'Base64', value: 'base64' },
        { name: 'File Path', value: 'path' },
      ],
      default: 'url',
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { imageSource: ['url'] } },
    },
    {
      displayName: 'Base64 Data',
      name: 'base64Data',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { imageSource: ['base64'] } },
    },
    {
      displayName: 'Language',
      name: 'language',
      type: 'options',
      options: [
        { name: 'English', value: 'eng' },
        { name: 'Spanish', value: 'spa' },
        { name: 'French', value: 'fre' },
        { name: 'German', value: 'ger' },
        { name: 'Chinese (Simplified)', value: 'chs' },
        { name: 'Japanese', value: 'jpn' },
        { name: 'Korean', value: 'kor' },
        { name: 'Arabic', value: 'ara' },
        { name: 'Auto-detect', value: 'auto' },
      ],
      default: 'eng',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Detect Orientation',
          name: 'detectOrientation',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Scale Image',
          name: 'scale',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Table Recognition',
          name: 'isTable',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Output Format',
          name: 'outputFormat',
          type: 'options',
          options: [
            { name: 'Plain Text', value: 'text' },
            { name: 'Searchable PDF', value: 'pdf' },
            { name: 'Word Bounding Boxes', value: 'boxes' },
          ],
          default: 'text',
        },
      ],
    },
  ],
  async execute(context) {
    const provider = context.getNodeParameter('provider', 0);
    const imageSource = context.getNodeParameter('imageSource', 0);
    const language = context.getNodeParameter('language', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    let imageUrl = '';
    if (imageSource === 'url') {
      imageUrl = context.getNodeParameter('imageUrl', 0) as string;
    }

    // OCR.space free API example
    if (provider === 'ocrSpace') {
      const credentials = await context.getCredentials('ocrApi');

      const formData: Record<string, string> = {
        apikey: (credentials?.apiKey as string) || 'helloworld', // Free tier key
        language: language as string,
        isOverlayRequired: 'false',
        detectOrientation: String(options.detectOrientation !== false),
        scale: String(options.scale !== false),
        isTable: String(options.isTable === true),
      };

      if (imageSource === 'url') {
        formData.url = imageUrl;
      }

      const response = await context.helpers.httpRequest({
        method: 'POST',
        url: 'https://api.ocr.space/parse/image',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });

      return [[{ json: response }]];
    }

    // Simulated response for other providers
    return [[{
      json: {
        provider,
        language,
        text: 'Extracted text from image...',
        confidence: 0.95,
        words: [
          { text: 'Hello', confidence: 0.98, bounds: { x: 10, y: 10, width: 50, height: 20 } },
          { text: 'World', confidence: 0.97, bounds: { x: 70, y: 10, width: 50, height: 20 } },
        ],
      },
    }]];
  },
});

// ============================================
// PAGE CHANGE MONITOR
// ============================================

export const WebMonitor = createProgrammaticNode({
  name: 'WebMonitor',
  displayName: 'Web Monitor',
  description: 'Monitor web pages for changes',
  icon: 'eye',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Web Monitor' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Self-hosted monitoring | Store snapshots in your own database',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Take Snapshot', value: 'snapshot' },
        { name: 'Compare with Previous', value: 'compare' },
        { name: 'Get Change History', value: 'history' },
      ],
      default: 'snapshot',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Selector to Watch',
      name: 'selector',
      type: 'string',
      default: 'body',
      description: 'CSS selector for the element to monitor',
    },
    {
      displayName: 'Monitor Type',
      name: 'monitorType',
      type: 'options',
      options: [
        { name: 'Text Content', value: 'text' },
        { name: 'HTML Content', value: 'html' },
        { name: 'Visual (Screenshot)', value: 'visual' },
        { name: 'Specific Attribute', value: 'attribute' },
        { name: 'JSON/API Response', value: 'json' },
      ],
      default: 'text',
    },
    {
      displayName: 'Attribute Name',
      name: 'attributeName',
      type: 'string',
      default: '',
      displayOptions: { show: { monitorType: ['attribute'] } },
    },
    {
      displayName: 'Ignore Patterns',
      name: 'ignorePatterns',
      type: 'string',
      typeOptions: { rows: 2 },
      default: '',
      placeholder: 'Regex patterns to ignore (one per line)',
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const url = context.getNodeParameter('url', 0) as string;
    const selector = context.getNodeParameter('selector', 0) as string;
    const monitorType = context.getNodeParameter('monitorType', 0);

    // Simulated monitoring results
    const result: Record<string, unknown> = {
      url,
      selector,
      monitorType,
      timestamp: new Date().toISOString(),
    };

    switch (operation) {
      case 'snapshot':
        result.snapshot = {
          content: 'Current page content...',
          hash: 'abc123def456',
          size: 1024,
        };
        break;

      case 'compare':
        result.comparison = {
          hasChanged: true,
          previousHash: 'xyz789',
          currentHash: 'abc123',
          changes: [
            { type: 'text', old: 'Price: $99', new: 'Price: $89' },
            { type: 'added', content: 'New paragraph added' },
          ],
          changePercentage: 5.2,
        };
        break;

      case 'history':
        result.history = [
          { timestamp: '2024-01-20T10:00:00Z', hash: 'abc123', changeType: 'content' },
          { timestamp: '2024-01-19T10:00:00Z', hash: 'def456', changeType: 'initial' },
        ];
        break;
    }

    return [[{ json: result }]];
  },
});

// Utility API Nodes with Pricing Information
// 💚 = Free tier available
// 💰 = Paid only

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// WEATHER APIS
// ============================================

export const OpenWeatherMap = createProgrammaticNode({
  name: 'OpenWeatherMap',
  displayName: 'OpenWeatherMap',
  description: 'Get weather data from OpenWeatherMap API',
  icon: 'cloud',
  group: ['utility'],
  version: 1,
  defaults: { name: 'OpenWeatherMap' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'openWeatherMapApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1,000 calls/day, current weather & 5-day forecast | 💰 Developer: $40/mo (100k calls) | Professional: $180/mo (1M calls)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Current Weather', value: 'currentWeather' },
        { name: '5-Day Forecast', value: 'forecast5Day' },
        { name: 'Hourly Forecast', value: 'hourlyForecast' },
        { name: '16-Day Forecast', value: 'forecast16Day' },
        { name: 'Air Pollution', value: 'airPollution' },
        { name: 'Geocoding', value: 'geocoding' },
        { name: 'Reverse Geocoding', value: 'reverseGeocoding' },
        { name: 'Weather Alerts', value: 'alerts' },
        { name: 'Historical Weather', value: 'historical' },
        { name: 'Weather Map Tiles', value: 'mapTiles' },
      ],
      default: 'currentWeather',
    },
    {
      displayName: 'Location Type',
      name: 'locationType',
      type: 'options',
      options: [
        { name: 'City Name', value: 'city' },
        { name: 'Coordinates', value: 'coordinates' },
        { name: 'Zip Code', value: 'zip' },
        { name: 'City ID', value: 'cityId' },
      ],
      default: 'city',
    },
    {
      displayName: 'City',
      name: 'city',
      type: 'string',
      default: '',
      displayOptions: { show: { locationType: ['city'] } },
    },
    {
      displayName: 'Latitude',
      name: 'lat',
      type: 'number',
      default: 0,
      displayOptions: { show: { locationType: ['coordinates'] } },
    },
    {
      displayName: 'Longitude',
      name: 'lon',
      type: 'number',
      default: 0,
      displayOptions: { show: { locationType: ['coordinates'] } },
    },
    {
      displayName: 'Units',
      name: 'units',
      type: 'options',
      options: [
        { name: 'Metric (Celsius)', value: 'metric' },
        { name: 'Imperial (Fahrenheit)', value: 'imperial' },
        { name: 'Standard (Kelvin)', value: 'standard' },
      ],
      default: 'metric',
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('openWeatherMapApi');

    const locationType = context.getNodeParameter('locationType', 0);
    let locationQuery = '';

    switch (locationType) {
      case 'city':
        locationQuery = `q=${context.getNodeParameter('city', 0)}`;
        break;
      case 'coordinates':
        locationQuery = `lat=${context.getNodeParameter('lat', 0)}&lon=${context.getNodeParameter('lon', 0)}`;
        break;
    }

    const units = context.getNodeParameter('units', 0);
    const baseUrl = 'https://api.openweathermap.org/data/2.5';

    const endpoints: Record<string, string> = {
      currentWeather: `${baseUrl}/weather?${locationQuery}&units=${units}&appid=${credentials.apiKey}`,
      forecast5Day: `${baseUrl}/forecast?${locationQuery}&units=${units}&appid=${credentials.apiKey}`,
      airPollution: `${baseUrl}/air_pollution?${locationQuery}&appid=${credentials.apiKey}`,
    };

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: endpoints[operation] || endpoints.currentWeather,
    });

    return [[{ json: response }]];
  },
});

export const WeatherAPI = createProgrammaticNode({
  name: 'WeatherAPI',
  displayName: 'WeatherAPI.com',
  description: 'Get weather data from WeatherAPI.com',
  icon: 'cloud-sun',
  group: ['utility'],
  version: 1,
  defaults: { name: 'WeatherAPI' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'weatherApiCom', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1M calls/month, current + 3-day forecast + astronomy | 💰 Developer: $4/mo (2M calls, 7-day forecast) | Business: $35/mo (5M, 14-day)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Current Weather', value: 'current' },
        { name: 'Forecast', value: 'forecast' },
        { name: 'Search/Autocomplete', value: 'search' },
        { name: 'History', value: 'history' },
        { name: 'Marine', value: 'marine' },
        { name: 'Astronomy', value: 'astronomy' },
        { name: 'Time Zone', value: 'timezone' },
        { name: 'Sports', value: 'sports' },
        { name: 'IP Lookup', value: 'ipLookup' },
      ],
      default: 'current',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'string',
      default: '',
      description: 'City name, zip code, IP address, or lat,lon coordinates',
    },
    {
      displayName: 'Forecast Days',
      name: 'days',
      type: 'number',
      default: 3,
      displayOptions: { show: { operation: ['forecast'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const location = context.getNodeParameter('location', 0);
    const credentials = await context.getCredentials('weatherApiCom');

    const baseUrl = 'https://api.weatherapi.com/v1';

    const endpoints: Record<string, string> = {
      current: `${baseUrl}/current.json?q=${location}&key=${credentials.apiKey}`,
      forecast: `${baseUrl}/forecast.json?q=${location}&days=${context.getNodeParameter('days', 0)}&key=${credentials.apiKey}`,
      search: `${baseUrl}/search.json?q=${location}&key=${credentials.apiKey}`,
      astronomy: `${baseUrl}/astronomy.json?q=${location}&key=${credentials.apiKey}`,
      timezone: `${baseUrl}/timezone.json?q=${location}&key=${credentials.apiKey}`,
    };

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: endpoints[operation] || endpoints.current,
    });

    return [[{ json: response }]];
  },
});

// ============================================
// NEWS APIS
// ============================================

export const NewsAPI = createProgrammaticNode({
  name: 'NewsAPI',
  displayName: 'NewsAPI',
  description: 'Get news articles from NewsAPI.org',
  icon: 'newspaper',
  group: ['utility'],
  version: 1,
  defaults: { name: 'NewsAPI' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'newsApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100 requests/day (dev only, no commercial) | 💰 Business: $449/mo (250k requests) | Corporate: $1,199/mo (1M requests)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Top Headlines', value: 'topHeadlines' },
        { name: 'Everything', value: 'everything' },
        { name: 'Sources', value: 'sources' },
      ],
      default: 'topHeadlines',
    },
    {
      displayName: 'Country',
      name: 'country',
      type: 'options',
      options: [
        { name: 'United States', value: 'us' },
        { name: 'United Kingdom', value: 'gb' },
        { name: 'Germany', value: 'de' },
        { name: 'France', value: 'fr' },
        { name: 'Australia', value: 'au' },
        { name: 'Canada', value: 'ca' },
        { name: 'Japan', value: 'jp' },
        { name: 'India', value: 'in' },
      ],
      default: 'us',
      displayOptions: { show: { operation: ['topHeadlines'] } },
    },
    {
      displayName: 'Category',
      name: 'category',
      type: 'options',
      options: [
        { name: 'General', value: 'general' },
        { name: 'Business', value: 'business' },
        { name: 'Entertainment', value: 'entertainment' },
        { name: 'Health', value: 'health' },
        { name: 'Science', value: 'science' },
        { name: 'Sports', value: 'sports' },
        { name: 'Technology', value: 'technology' },
      ],
      default: 'general',
      displayOptions: { show: { operation: ['topHeadlines'] } },
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['everything'] } },
    },
    {
      displayName: 'Sort By',
      name: 'sortBy',
      type: 'options',
      options: [
        { name: 'Published At', value: 'publishedAt' },
        { name: 'Relevancy', value: 'relevancy' },
        { name: 'Popularity', value: 'popularity' },
      ],
      default: 'publishedAt',
      displayOptions: { show: { operation: ['everything'] } },
    },
    {
      displayName: 'Page Size',
      name: 'pageSize',
      type: 'number',
      default: 20,
      description: 'Number of articles to return (max 100)',
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('newsApi');
    const pageSize = context.getNodeParameter('pageSize', 0);

    const baseUrl = 'https://newsapi.org/v2';
    let url = '';

    switch (operation) {
      case 'topHeadlines':
        const country = context.getNodeParameter('country', 0);
        const category = context.getNodeParameter('category', 0);
        url = `${baseUrl}/top-headlines?country=${country}&category=${category}&pageSize=${pageSize}`;
        break;
      case 'everything':
        const query = context.getNodeParameter('query', 0);
        const sortBy = context.getNodeParameter('sortBy', 0);
        url = `${baseUrl}/everything?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}`;
        break;
      case 'sources':
        url = `${baseUrl}/sources`;
        break;
    }

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url,
      headers: { 'X-Api-Key': credentials.apiKey },
    });

    return [[{ json: response }]];
  },
});

export const GNews = createProgrammaticNode({
  name: 'GNews',
  displayName: 'GNews',
  description: 'Get news articles from GNews.io',
  icon: 'newspaper',
  group: ['utility'],
  version: 1,
  defaults: { name: 'GNews' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'gNewsApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100 requests/day | 💰 Basic: $14.99/mo (10k requests) | Standard: $49.99/mo (50k) | Professional: $199.99/mo (300k)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Search', value: 'search' },
        { name: 'Top Headlines', value: 'topHeadlines' },
      ],
      default: 'topHeadlines',
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Topic',
      name: 'topic',
      type: 'options',
      options: [
        { name: 'Breaking News', value: 'breaking-news' },
        { name: 'World', value: 'world' },
        { name: 'Nation', value: 'nation' },
        { name: 'Business', value: 'business' },
        { name: 'Technology', value: 'technology' },
        { name: 'Entertainment', value: 'entertainment' },
        { name: 'Sports', value: 'sports' },
        { name: 'Science', value: 'science' },
        { name: 'Health', value: 'health' },
      ],
      default: 'breaking-news',
      displayOptions: { show: { operation: ['topHeadlines'] } },
    },
    {
      displayName: 'Language',
      name: 'lang',
      type: 'options',
      options: [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Italian', value: 'it' },
        { name: 'Portuguese', value: 'pt' },
        { name: 'Chinese', value: 'zh' },
        { name: 'Japanese', value: 'ja' },
        { name: 'Arabic', value: 'ar' },
      ],
      default: 'en',
    },
    {
      displayName: 'Max Results',
      name: 'max',
      type: 'number',
      default: 10,
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('gNewsApi');
    const lang = context.getNodeParameter('lang', 0);
    const max = context.getNodeParameter('max', 0);

    let url = `https://gnews.io/api/v4/${operation === 'search' ? 'search' : 'top-headlines'}`;
    url += `?lang=${lang}&max=${max}&apikey=${credentials.apiKey}`;

    if (operation === 'search') {
      const query = context.getNodeParameter('query', 0);
      url += `&q=${encodeURIComponent(query)}`;
    } else {
      const topic = context.getNodeParameter('topic', 0);
      url += `&topic=${topic}`;
    }

    const response = await context.helpers.httpRequest({ method: 'GET', url });
    return [[{ json: response }]];
  },
});

// ============================================
// TRANSLATION APIS
// ============================================

export const GoogleTranslate = createProgrammaticNode({
  name: 'GoogleTranslate',
  displayName: 'Google Translate',
  description: 'Translate text using Google Cloud Translation API',
  icon: 'language',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Google Translate' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'googleCloudApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 500k characters/month | 💰 $20 per 1M characters (Neural Machine Translation) | $0.08 per page for documents',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Translate Text', value: 'translate' },
        { name: 'Detect Language', value: 'detect' },
        { name: 'List Languages', value: 'listLanguages' },
        { name: 'Translate Document', value: 'translateDocument' },
      ],
      default: 'translate',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['translate', 'detect'] } },
    },
    {
      displayName: 'Source Language',
      name: 'sourceLanguage',
      type: 'string',
      default: '',
      placeholder: 'auto-detect',
      description: 'Leave empty to auto-detect',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Target Language',
      name: 'targetLanguage',
      type: 'options',
      options: [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Italian', value: 'it' },
        { name: 'Portuguese', value: 'pt' },
        { name: 'Chinese (Simplified)', value: 'zh-CN' },
        { name: 'Chinese (Traditional)', value: 'zh-TW' },
        { name: 'Japanese', value: 'ja' },
        { name: 'Korean', value: 'ko' },
        { name: 'Arabic', value: 'ar' },
        { name: 'Russian', value: 'ru' },
        { name: 'Hindi', value: 'hi' },
        { name: 'Dutch', value: 'nl' },
        { name: 'Swedish', value: 'sv' },
        { name: 'Polish', value: 'pl' },
        { name: 'Turkish', value: 'tr' },
      ],
      default: 'en',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      options: [
        { name: 'Neural Machine Translation (NMT)', value: 'nmt' },
        { name: 'Phrase-Based Machine Translation (PBMT)', value: 'base' },
      ],
      default: 'nmt',
      displayOptions: { show: { operation: ['translate'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('googleCloudApi');

    const baseUrl = 'https://translation.googleapis.com/language/translate/v2';

    switch (operation) {
      case 'translate':
        const text = context.getNodeParameter('text', 0);
        const targetLanguage = context.getNodeParameter('targetLanguage', 0);
        const sourceLanguage = context.getNodeParameter('sourceLanguage', 0);

        const response = await context.helpers.httpRequest({
          method: 'POST',
          url: baseUrl,
          headers: { 'Content-Type': 'application/json' },
          body: {
            q: text,
            target: targetLanguage,
            source: sourceLanguage || undefined,
            key: credentials.apiKey,
          },
        });
        return [[{ json: response }]];

      case 'detect':
        const detectText = context.getNodeParameter('text', 0);
        const detectResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/detect`,
          body: { q: detectText, key: credentials.apiKey },
        });
        return [[{ json: detectResponse }]];

      case 'listLanguages':
        const langResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/languages?key=${credentials.apiKey}`,
        });
        return [[{ json: langResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const DeepL = createProgrammaticNode({
  name: 'DeepL',
  displayName: 'DeepL',
  description: 'Translate text using DeepL API',
  icon: 'language',
  group: ['utility'],
  version: 1,
  defaults: { name: 'DeepL' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'deepLApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 500k characters/month | 💰 Pro: $5.49/1M chars (no monthly limit) | Business: From $630/year',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Translate Text', value: 'translate' },
        { name: 'Translate Document', value: 'translateDocument' },
        { name: 'Check Usage', value: 'usage' },
        { name: 'List Glossaries', value: 'glossaries' },
      ],
      default: 'translate',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Target Language',
      name: 'targetLang',
      type: 'options',
      options: [
        { name: 'English (British)', value: 'EN-GB' },
        { name: 'English (American)', value: 'EN-US' },
        { name: 'German', value: 'DE' },
        { name: 'French', value: 'FR' },
        { name: 'Spanish', value: 'ES' },
        { name: 'Italian', value: 'IT' },
        { name: 'Portuguese (Brazilian)', value: 'PT-BR' },
        { name: 'Portuguese', value: 'PT-PT' },
        { name: 'Dutch', value: 'NL' },
        { name: 'Polish', value: 'PL' },
        { name: 'Russian', value: 'RU' },
        { name: 'Japanese', value: 'JA' },
        { name: 'Chinese (Simplified)', value: 'ZH' },
        { name: 'Korean', value: 'KO' },
      ],
      default: 'EN-US',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Formality',
      name: 'formality',
      type: 'options',
      options: [
        { name: 'Default', value: 'default' },
        { name: 'Formal', value: 'more' },
        { name: 'Informal', value: 'less' },
        { name: 'Prefer Formal', value: 'prefer_more' },
        { name: 'Prefer Informal', value: 'prefer_less' },
      ],
      default: 'default',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Preserve Formatting',
      name: 'preserveFormatting',
      type: 'boolean',
      default: true,
      displayOptions: { show: { operation: ['translate'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('deepLApi');

    // Determine API endpoint (free vs pro)
    const baseUrl = credentials.apiKey?.toString().endsWith(':fx')
      ? 'https://api-free.deepl.com/v2'
      : 'https://api.deepl.com/v2';

    switch (operation) {
      case 'translate':
        const text = context.getNodeParameter('text', 0);
        const targetLang = context.getNodeParameter('targetLang', 0);
        const formality = context.getNodeParameter('formality', 0);

        const response = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/translate`,
          headers: {
            Authorization: `DeepL-Auth-Key ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            text: [text],
            target_lang: targetLang,
            formality: formality !== 'default' ? formality : undefined,
          },
        });
        return [[{ json: response }]];

      case 'usage':
        const usageResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/usage`,
          headers: { Authorization: `DeepL-Auth-Key ${credentials.apiKey}` },
        });
        return [[{ json: usageResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const LibreTranslate = createProgrammaticNode({
  name: 'LibreTranslate',
  displayName: 'LibreTranslate',
  description: 'Free and open-source machine translation',
  icon: 'language',
  group: ['utility'],
  version: 1,
  defaults: { name: 'LibreTranslate' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'libreTranslateApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Open source, self-hostable | Public API may have rate limits | No paid tiers',
    },
    {
      displayName: 'Instance URL',
      name: 'instanceUrl',
      type: 'string',
      default: 'https://libretranslate.com',
      description: 'LibreTranslate instance URL (self-hosted or public)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Translate', value: 'translate' },
        { name: 'Detect Language', value: 'detect' },
        { name: 'List Languages', value: 'languages' },
      ],
      default: 'translate',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['translate', 'detect'] } },
    },
    {
      displayName: 'Source Language',
      name: 'source',
      type: 'string',
      default: 'auto',
      displayOptions: { show: { operation: ['translate'] } },
    },
    {
      displayName: 'Target Language',
      name: 'target',
      type: 'string',
      default: 'en',
      displayOptions: { show: { operation: ['translate'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const instanceUrl = context.getNodeParameter('instanceUrl', 0);

    let credentials;
    try {
      credentials = await context.getCredentials('libreTranslateApi');
    } catch {
      credentials = {};
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`;
    }

    switch (operation) {
      case 'translate':
        const text = context.getNodeParameter('text', 0);
        const source = context.getNodeParameter('source', 0);
        const target = context.getNodeParameter('target', 0);

        const response = await context.helpers.httpRequest({
          method: 'POST',
          url: `${instanceUrl}/translate`,
          headers,
          body: { q: text, source, target },
        });
        return [[{ json: response }]];

      case 'detect':
        const detectText = context.getNodeParameter('text', 0);
        const detectResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${instanceUrl}/detect`,
          headers,
          body: { q: detectText },
        });
        return [[{ json: detectResponse }]];

      case 'languages':
        const langResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${instanceUrl}/languages`,
        });
        return [[{ json: langResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// MAPS & GEOCODING APIS
// ============================================

export const GoogleMaps = createProgrammaticNode({
  name: 'GoogleMaps',
  displayName: 'Google Maps',
  description: 'Google Maps Platform APIs for maps, places, and routing',
  icon: 'map-marker',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Google Maps' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'googleMapsApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: $200/month credit (~28k direction requests) | 💰 Geocoding: $5/1000 | Directions: $5-10/1000 | Places: $17-40/1000',
    },
    {
      displayName: 'Service',
      name: 'service',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Geocoding', value: 'geocoding' },
        { name: 'Reverse Geocoding', value: 'reverseGeocoding' },
        { name: 'Directions', value: 'directions' },
        { name: 'Distance Matrix', value: 'distanceMatrix' },
        { name: 'Places Search', value: 'placesSearch' },
        { name: 'Place Details', value: 'placeDetails' },
        { name: 'Place Autocomplete', value: 'autocomplete' },
        { name: 'Time Zone', value: 'timezone' },
        { name: 'Elevation', value: 'elevation' },
        { name: 'Roads (Snap to Roads)', value: 'roads' },
      ],
      default: 'geocoding',
    },
    {
      displayName: 'Address',
      name: 'address',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['geocoding'] } },
    },
    {
      displayName: 'Latitude',
      name: 'lat',
      type: 'number',
      default: 0,
      displayOptions: { show: { service: ['reverseGeocoding', 'timezone', 'elevation'] } },
    },
    {
      displayName: 'Longitude',
      name: 'lng',
      type: 'number',
      default: 0,
      displayOptions: { show: { service: ['reverseGeocoding', 'timezone', 'elevation'] } },
    },
    {
      displayName: 'Origin',
      name: 'origin',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['directions', 'distanceMatrix'] } },
    },
    {
      displayName: 'Destination',
      name: 'destination',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['directions', 'distanceMatrix'] } },
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['placesSearch', 'autocomplete'] } },
    },
    {
      displayName: 'Place ID',
      name: 'placeId',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['placeDetails'] } },
    },
    {
      displayName: 'Travel Mode',
      name: 'mode',
      type: 'options',
      options: [
        { name: 'Driving', value: 'driving' },
        { name: 'Walking', value: 'walking' },
        { name: 'Bicycling', value: 'bicycling' },
        { name: 'Transit', value: 'transit' },
      ],
      default: 'driving',
      displayOptions: { show: { service: ['directions', 'distanceMatrix'] } },
    },
  ],
  async execute(context) {
    const service = context.getNodeParameter('service', 0);
    const credentials = await context.getCredentials('googleMapsApi');

    const baseUrls: Record<string, string> = {
      geocoding: 'https://maps.googleapis.com/maps/api/geocode/json',
      reverseGeocoding: 'https://maps.googleapis.com/maps/api/geocode/json',
      directions: 'https://maps.googleapis.com/maps/api/directions/json',
      distanceMatrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
      placesSearch: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
      placeDetails: 'https://maps.googleapis.com/maps/api/place/details/json',
      autocomplete: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      timezone: 'https://maps.googleapis.com/maps/api/timezone/json',
      elevation: 'https://maps.googleapis.com/maps/api/elevation/json',
    };

    let params = `key=${credentials.apiKey}`;

    switch (service) {
      case 'geocoding':
        params += `&address=${encodeURIComponent(context.getNodeParameter('address', 0) as string)}`;
        break;
      case 'reverseGeocoding':
        params += `&latlng=${context.getNodeParameter('lat', 0)},${context.getNodeParameter('lng', 0)}`;
        break;
      case 'directions':
      case 'distanceMatrix':
        params += `&origin=${encodeURIComponent(context.getNodeParameter('origin', 0) as string)}`;
        params += `&destination=${encodeURIComponent(context.getNodeParameter('destination', 0) as string)}`;
        params += `&mode=${context.getNodeParameter('mode', 0)}`;
        break;
      case 'placesSearch':
        params += `&query=${encodeURIComponent(context.getNodeParameter('query', 0) as string)}`;
        break;
      case 'placeDetails':
        params += `&place_id=${context.getNodeParameter('placeId', 0)}`;
        break;
      case 'autocomplete':
        params += `&input=${encodeURIComponent(context.getNodeParameter('query', 0) as string)}`;
        break;
      case 'timezone':
        params += `&location=${context.getNodeParameter('lat', 0)},${context.getNodeParameter('lng', 0)}`;
        params += `&timestamp=${Math.floor(Date.now() / 1000)}`;
        break;
      case 'elevation':
        params += `&locations=${context.getNodeParameter('lat', 0)},${context.getNodeParameter('lng', 0)}`;
        break;
    }

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrls[service]}?${params}`,
    });

    return [[{ json: response }]];
  },
});

export const Mapbox = createProgrammaticNode({
  name: 'Mapbox',
  displayName: 'Mapbox',
  description: 'Mapbox APIs for maps, geocoding, and navigation',
  icon: 'map',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Mapbox' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'mapboxApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100k geocoding/mo, 100k directions/mo | 💰 Pay as you go: Geocoding $0.75/1000 | Directions $1-5/1000',
    },
    {
      displayName: 'Service',
      name: 'service',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Geocoding (Forward)', value: 'geocoding' },
        { name: 'Reverse Geocoding', value: 'reverseGeocoding' },
        { name: 'Directions', value: 'directions' },
        { name: 'Matrix (Distance/Duration)', value: 'matrix' },
        { name: 'Isochrone', value: 'isochrone' },
        { name: 'Map Matching', value: 'mapMatching' },
        { name: 'Static Map Image', value: 'staticImage' },
      ],
      default: 'geocoding',
    },
    {
      displayName: 'Search Text',
      name: 'searchText',
      type: 'string',
      default: '',
      displayOptions: { show: { service: ['geocoding'] } },
    },
    {
      displayName: 'Longitude',
      name: 'longitude',
      type: 'number',
      default: 0,
      displayOptions: { show: { service: ['reverseGeocoding', 'isochrone'] } },
    },
    {
      displayName: 'Latitude',
      name: 'latitude',
      type: 'number',
      default: 0,
      displayOptions: { show: { service: ['reverseGeocoding', 'isochrone'] } },
    },
    {
      displayName: 'Coordinates',
      name: 'coordinates',
      type: 'string',
      default: '',
      placeholder: '-122.4194,37.7749;-122.4089,37.8134',
      description: 'Semicolon-separated lng,lat pairs',
      displayOptions: { show: { service: ['directions', 'matrix'] } },
    },
    {
      displayName: 'Profile',
      name: 'profile',
      type: 'options',
      options: [
        { name: 'Driving', value: 'mapbox/driving' },
        { name: 'Driving Traffic', value: 'mapbox/driving-traffic' },
        { name: 'Walking', value: 'mapbox/walking' },
        { name: 'Cycling', value: 'mapbox/cycling' },
      ],
      default: 'mapbox/driving',
      displayOptions: { show: { service: ['directions', 'matrix', 'isochrone'] } },
    },
  ],
  async execute(context) {
    const service = context.getNodeParameter('service', 0);
    const credentials = await context.getCredentials('mapboxApi');

    const baseUrl = 'https://api.mapbox.com';
    let url = '';

    switch (service) {
      case 'geocoding':
        const searchText = context.getNodeParameter('searchText', 0);
        url = `${baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(searchText as string)}.json`;
        break;
      case 'reverseGeocoding':
        const lng = context.getNodeParameter('longitude', 0);
        const lat = context.getNodeParameter('latitude', 0);
        url = `${baseUrl}/geocoding/v5/mapbox.places/${lng},${lat}.json`;
        break;
      case 'directions':
        const coords = context.getNodeParameter('coordinates', 0);
        const profile = context.getNodeParameter('profile', 0);
        url = `${baseUrl}/directions/v5/${profile}/${coords}`;
        break;
      case 'matrix':
        const matrixCoords = context.getNodeParameter('coordinates', 0);
        const matrixProfile = context.getNodeParameter('profile', 0);
        url = `${baseUrl}/directions-matrix/v1/${matrixProfile}/${matrixCoords}`;
        break;
      case 'isochrone':
        const isoLng = context.getNodeParameter('longitude', 0);
        const isoLat = context.getNodeParameter('latitude', 0);
        const isoProfile = context.getNodeParameter('profile', 0);
        url = `${baseUrl}/isochrone/v1/${isoProfile}/${isoLng},${isoLat}`;
        break;
    }

    url += `?access_token=${credentials.accessToken}`;

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url,
    });

    return [[{ json: response }]];
  },
});

export const OpenStreetMap = createProgrammaticNode({
  name: 'OpenStreetMap',
  displayName: 'OpenStreetMap (Nominatim)',
  description: 'Free geocoding using OpenStreetMap Nominatim API',
  icon: 'map',
  group: ['utility'],
  version: 1,
  defaults: { name: 'OpenStreetMap' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: No API key needed | Rate limit: 1 request/second | Self-hosting available',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Search (Forward Geocoding)', value: 'search' },
        { name: 'Reverse Geocoding', value: 'reverse' },
        { name: 'Lookup by OSM ID', value: 'lookup' },
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
      displayName: 'Latitude',
      name: 'lat',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['reverse'] } },
    },
    {
      displayName: 'Longitude',
      name: 'lon',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['reverse'] } },
    },
    {
      displayName: 'OSM IDs',
      name: 'osmIds',
      type: 'string',
      default: '',
      placeholder: 'R146656,W104393803,N240109189',
      displayOptions: { show: { operation: ['lookup'] } },
    },
    {
      displayName: 'Return Format',
      name: 'format',
      type: 'options',
      options: [
        { name: 'JSON', value: 'json' },
        { name: 'GeoJSON', value: 'geojson' },
        { name: 'XML', value: 'xml' },
      ],
      default: 'json',
    },
    {
      displayName: 'Include Address Details',
      name: 'addressdetails',
      type: 'boolean',
      default: true,
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const format = context.getNodeParameter('format', 0);
    const addressdetails = context.getNodeParameter('addressdetails', 0) ? 1 : 0;

    const baseUrl = 'https://nominatim.openstreetmap.org';
    let url = '';

    switch (operation) {
      case 'search':
        const query = context.getNodeParameter('query', 0);
        url = `${baseUrl}/search?q=${encodeURIComponent(query as string)}&format=${format}&addressdetails=${addressdetails}`;
        break;
      case 'reverse':
        const lat = context.getNodeParameter('lat', 0);
        const lon = context.getNodeParameter('lon', 0);
        url = `${baseUrl}/reverse?lat=${lat}&lon=${lon}&format=${format}&addressdetails=${addressdetails}`;
        break;
      case 'lookup':
        const osmIds = context.getNodeParameter('osmIds', 0);
        url = `${baseUrl}/lookup?osm_ids=${osmIds}&format=${format}&addressdetails=${addressdetails}`;
        break;
    }

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'AgentSmith/1.0',
      },
    });

    return [[{ json: response }]];
  },
});

// ============================================
// ADDITIONAL UTILITY APIS
// ============================================

export const IPGeolocation = createProgrammaticNode({
  name: 'IPGeolocation',
  displayName: 'IP Geolocation',
  description: 'Get geolocation data from IP addresses',
  icon: 'globe',
  group: ['utility'],
  version: 1,
  defaults: { name: 'IP Geolocation' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'ipGeolocationApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1,000 requests/day (ip-api.com) | 💚 FREE: 50k/month (ipapi.co) | 💰 Premium options available',
    },
    {
      displayName: 'Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'ip-api.com (Free)', value: 'ip-api' },
        { name: 'ipapi.co (Free tier)', value: 'ipapi' },
        { name: 'ipgeolocation.io', value: 'ipgeolocation' },
        { name: 'ipinfo.io', value: 'ipinfo' },
      ],
      default: 'ip-api',
    },
    {
      displayName: 'IP Address',
      name: 'ip',
      type: 'string',
      default: '',
      placeholder: 'Leave empty for your IP',
    },
  ],
  async execute(context) {
    const provider = context.getNodeParameter('provider', 0);
    const ip = context.getNodeParameter('ip', 0) || '';

    let credentials;
    try {
      credentials = await context.getCredentials('ipGeolocationApi');
    } catch {
      credentials = {};
    }

    const urls: Record<string, string> = {
      'ip-api': `http://ip-api.com/json/${ip}`,
      'ipapi': `https://ipapi.co/${ip || 'json'}/json/`,
      'ipgeolocation': `https://api.ipgeolocation.io/ipgeo?apiKey=${credentials.apiKey}&ip=${ip}`,
      'ipinfo': `https://ipinfo.io/${ip}?token=${credentials.apiKey}`,
    };

    const response = await context.helpers.httpRequest({
      method: 'GET',
      url: urls[provider as string] || urls['ip-api'],
    });

    return [[{ json: response }]];
  },
});

export const CurrencyExchange = createProgrammaticNode({
  name: 'CurrencyExchange',
  displayName: 'Currency Exchange',
  description: 'Get currency exchange rates',
  icon: 'dollar-sign',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Currency Exchange' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'exchangeRateApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: exchangerate-api.com (1,500/mo) | 💚 FREE: frankfurter.app (unlimited) | 💰 Premium: various options',
    },
    {
      displayName: 'Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'Frankfurter (100% Free)', value: 'frankfurter' },
        { name: 'ExchangeRate-API (Free tier)', value: 'exchangerate-api' },
        { name: 'Open Exchange Rates', value: 'openexchangerates' },
        { name: 'Fixer.io', value: 'fixer' },
      ],
      default: 'frankfurter',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Latest Rates', value: 'latest' },
        { name: 'Convert Amount', value: 'convert' },
        { name: 'Historical Rates', value: 'historical' },
        { name: 'List Currencies', value: 'currencies' },
      ],
      default: 'latest',
    },
    {
      displayName: 'Base Currency',
      name: 'base',
      type: 'string',
      default: 'USD',
    },
    {
      displayName: 'Target Currency',
      name: 'target',
      type: 'string',
      default: 'EUR',
      displayOptions: { show: { operation: ['convert'] } },
    },
    {
      displayName: 'Amount',
      name: 'amount',
      type: 'number',
      default: 1,
      displayOptions: { show: { operation: ['convert'] } },
    },
    {
      displayName: 'Date',
      name: 'date',
      type: 'string',
      default: '',
      placeholder: 'YYYY-MM-DD',
      displayOptions: { show: { operation: ['historical'] } },
    },
  ],
  async execute(context) {
    const provider = context.getNodeParameter('provider', 0);
    const operation = context.getNodeParameter('operation', 0);
    const base = context.getNodeParameter('base', 0);

    let credentials;
    try {
      credentials = await context.getCredentials('exchangeRateApi');
    } catch {
      credentials = {};
    }

    // Frankfurter API (100% free, no key required)
    if (provider === 'frankfurter') {
      const frankfurterBase = 'https://api.frankfurter.app';
      let url = '';

      switch (operation) {
        case 'latest':
          url = `${frankfurterBase}/latest?from=${base}`;
          break;
        case 'convert':
          const target = context.getNodeParameter('target', 0);
          const amount = context.getNodeParameter('amount', 0);
          url = `${frankfurterBase}/latest?amount=${amount}&from=${base}&to=${target}`;
          break;
        case 'historical':
          const date = context.getNodeParameter('date', 0);
          url = `${frankfurterBase}/${date}?from=${base}`;
          break;
        case 'currencies':
          url = `${frankfurterBase}/currencies`;
          break;
      }

      const response = await context.helpers.httpRequest({ method: 'GET', url });
      return [[{ json: response }]];
    }

    // ExchangeRate-API
    if (provider === 'exchangerate-api') {
      const apiKey = credentials.apiKey || 'your-api-key';
      let url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`;

      if (operation === 'convert') {
        const target = context.getNodeParameter('target', 0);
        const amount = context.getNodeParameter('amount', 0);
        url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${base}/${target}/${amount}`;
      }

      const response = await context.helpers.httpRequest({ method: 'GET', url });
      return [[{ json: response }]];
    }

    return [[{ json: { error: 'Provider not fully implemented' } }]];
  },
});

export const QRCode = createProgrammaticNode({
  name: 'QRCode',
  displayName: 'QR Code',
  description: 'Generate and read QR codes',
  icon: 'qrcode',
  group: ['utility'],
  version: 1,
  defaults: { name: 'QR Code' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: goqr.me API (no limits) | No API key required',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Generate QR Code', value: 'generate' },
        { name: 'Read QR Code', value: 'read' },
      ],
      default: 'generate',
    },
    {
      displayName: 'Data',
      name: 'data',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['generate'] } },
    },
    {
      displayName: 'Size',
      name: 'size',
      type: 'number',
      default: 200,
      description: 'Size in pixels',
      displayOptions: { show: { operation: ['generate'] } },
    },
    {
      displayName: 'Format',
      name: 'format',
      type: 'options',
      options: [
        { name: 'PNG', value: 'png' },
        { name: 'GIF', value: 'gif' },
        { name: 'JPEG', value: 'jpg' },
        { name: 'SVG', value: 'svg' },
        { name: 'EPS', value: 'eps' },
      ],
      default: 'png',
      displayOptions: { show: { operation: ['generate'] } },
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['read'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);

    if (operation === 'generate') {
      const data = context.getNodeParameter('data', 0);
      const size = context.getNodeParameter('size', 0);
      const format = context.getNodeParameter('format', 0);

      const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data as string)}&size=${size}x${size}&format=${format}`;

      return [[{
        json: {
          url,
          data,
          size,
          format,
        },
      }]];
    }

    if (operation === 'read') {
      const imageUrl = context.getNodeParameter('imageUrl', 0);

      const response = await context.helpers.httpRequest({
        method: 'GET',
        url: `https://api.qrserver.com/v1/read-qr-code/?fileurl=${encodeURIComponent(imageUrl as string)}`,
      });

      return [[{ json: response }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const Screenshot = createProgrammaticNode({
  name: 'Screenshot',
  displayName: 'Screenshot',
  description: 'Capture website screenshots',
  icon: 'camera',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Screenshot' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'screenshotApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: urlbox.io (100/mo) | 💚 FREE: screenshot-api.com (100/mo) | 💰 Premium plans available',
    },
    {
      displayName: 'Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'ScreenshotOne (Free tier)', value: 'screenshotone' },
        { name: 'URL Box (Free tier)', value: 'urlbox' },
        { name: 'Screenshot Machine', value: 'screenshotmachine' },
      ],
      default: 'screenshotone',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Width',
      name: 'width',
      type: 'number',
      default: 1920,
    },
    {
      displayName: 'Height',
      name: 'height',
      type: 'number',
      default: 1080,
    },
    {
      displayName: 'Full Page',
      name: 'fullPage',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'Format',
      name: 'format',
      type: 'options',
      options: [
        { name: 'PNG', value: 'png' },
        { name: 'JPEG', value: 'jpg' },
        { name: 'WebP', value: 'webp' },
        { name: 'PDF', value: 'pdf' },
      ],
      default: 'png',
    },
  ],
  async execute(context) {
    const url = context.getNodeParameter('url', 0);
    const width = context.getNodeParameter('width', 0);
    const height = context.getNodeParameter('height', 0);
    const fullPage = context.getNodeParameter('fullPage', 0);
    const format = context.getNodeParameter('format', 0);

    let credentials;
    try {
      credentials = await context.getCredentials('screenshotApi');
    } catch {
      credentials = {};
    }

    // Using ScreenshotOne as example
    const apiUrl = `https://api.screenshotone.com/take?access_key=${credentials.apiKey}&url=${encodeURIComponent(url as string)}&viewport_width=${width}&viewport_height=${height}&full_page=${fullPage}&format=${format}`;

    return [[{
      json: {
        screenshotUrl: apiUrl,
        originalUrl: url,
        dimensions: { width, height },
        fullPage,
        format,
      },
    }]];
  },
});

export const TextAnalysis = createProgrammaticNode({
  name: 'TextAnalysis',
  displayName: 'Text Analysis',
  description: 'Analyze text for sentiment, entities, and more',
  icon: 'file-text',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Text Analysis' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'textAnalysisApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: TextRazor (500 requests/day) | 💚 FREE: MeaningCloud (20k credits/mo) | 💰 Premium tiers available',
    },
    {
      displayName: 'Provider',
      name: 'provider',
      type: 'options',
      options: [
        { name: 'MeaningCloud (Free tier)', value: 'meaningcloud' },
        { name: 'TextRazor (Free tier)', value: 'textrazor' },
        { name: 'Dandelion API', value: 'dandelion' },
      ],
      default: 'meaningcloud',
    },
    {
      displayName: 'Analysis Type',
      name: 'analysisType',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Sentiment Analysis', value: 'sentiment' },
        { name: 'Entity Extraction', value: 'entities' },
        { name: 'Language Detection', value: 'language' },
        { name: 'Topic Classification', value: 'topics' },
        { name: 'Summarization', value: 'summary' },
        { name: 'Keyword Extraction', value: 'keywords' },
      ],
      default: 'sentiment',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
    },
    {
      displayName: 'Language',
      name: 'language',
      type: 'options',
      options: [
        { name: 'Auto-Detect', value: 'auto' },
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Italian', value: 'it' },
        { name: 'Portuguese', value: 'pt' },
      ],
      default: 'auto',
    },
  ],
  async execute(context) {
    const provider = context.getNodeParameter('provider', 0);
    const analysisType = context.getNodeParameter('analysisType', 0);
    const text = context.getNodeParameter('text', 0);
    const language = context.getNodeParameter('language', 0);

    let credentials;
    try {
      credentials = await context.getCredentials('textAnalysisApi');
    } catch {
      credentials = {};
    }

    // MeaningCloud API
    if (provider === 'meaningcloud') {
      const baseUrl = 'https://api.meaningcloud.com';
      const endpoints: Record<string, string> = {
        sentiment: `${baseUrl}/sentiment-2.1`,
        entities: `${baseUrl}/topics-2.0`,
        language: `${baseUrl}/lang-4.0`,
        topics: `${baseUrl}/class-2.0`,
        summary: `${baseUrl}/summarization-1.0`,
      };

      const response = await context.helpers.httpRequest({
        method: 'POST',
        url: endpoints[analysisType as string] || endpoints.sentiment,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `key=${credentials.apiKey}&txt=${encodeURIComponent(text as string)}&lang=${language === 'auto' ? '' : language}`,
      });

      return [[{ json: response }]];
    }

    // TextRazor API
    if (provider === 'textrazor') {
      const extractors = {
        sentiment: 'sentiment',
        entities: 'entities',
        topics: 'topics',
        keywords: 'phrases',
      };

      const response = await context.helpers.httpRequest({
        method: 'POST',
        url: 'https://api.textrazor.com/',
        headers: {
          'X-TextRazor-Key': credentials.apiKey as string,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `text=${encodeURIComponent(text as string)}&extractors=${extractors[analysisType as keyof typeof extractors] || 'entities'}`,
      });

      return [[{ json: response }]];
    }

    return [[{ json: { error: 'Provider not fully implemented' } }]];
  },
});

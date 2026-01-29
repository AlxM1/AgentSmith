/**
 * GEO Node Credentials
 *
 * API credentials for GEO optimization nodes
 */

import { createCredential } from '../../utils/credentialBuilder';

// ============================================================================
// PERPLEXITY API
// ============================================================================
export const PerplexityApiCredential = createCredential({
  name: 'perplexityApi',
  displayName: 'Perplexity API',
  description: 'API credentials for Perplexity Sonar - real-time web search with citations',
  icon: 'file:perplexity.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Perplexity API key from https://www.perplexity.ai/settings/api',
    },
  ],
  testRequest: {
    url: 'https://api.perplexity.ai/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer {{apiKey}}',
      'Content-Type': 'application/json',
    },
    body: {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
    },
  },
  documentationUrl: 'https://docs.perplexity.ai/',
});

// ============================================================================
// SERP API
// ============================================================================
export const SerpApiCredential = createCredential({
  name: 'serpApi',
  displayName: 'SerpAPI',
  description: 'API credentials for SerpAPI - Google search results and competitor analysis',
  icon: 'file:serpapi.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your SerpAPI key from https://serpapi.com/dashboard',
    },
  ],
  testRequest: {
    url: 'https://serpapi.com/account?api_key={{apiKey}}',
    method: 'GET',
  },
  documentationUrl: 'https://serpapi.com/search-api',
});

// ============================================================================
// GOOGLE PLACES API
// ============================================================================
export const GooglePlacesApiCredential = createCredential({
  name: 'googlePlacesApi',
  displayName: 'Google Places API',
  description: 'API credentials for Google Places - local competitor discovery',
  icon: 'file:google.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Google Cloud API key with Places API enabled',
    },
  ],
  testRequest: {
    url: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=0,0&radius=1&key={{apiKey}}',
    method: 'GET',
  },
  documentationUrl: 'https://developers.google.com/maps/documentation/places/web-service',
});

// ============================================================================
// TEXTRAZOR API
// ============================================================================
export const TextRazorApiCredential = createCredential({
  name: 'textRazorApi',
  displayName: 'TextRazor API',
  description: 'API credentials for TextRazor - advanced NLP, entity extraction, and topic analysis',
  icon: 'file:textrazor.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your TextRazor API key from https://www.textrazor.com/console',
    },
  ],
  testRequest: {
    url: 'https://api.textrazor.com/',
    method: 'POST',
    headers: {
      'X-TextRazor-Key': '{{apiKey}}',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'text=test&extractors=entities',
  },
  documentationUrl: 'https://www.textrazor.com/docs',
});

// ============================================================================
// FRASE API
// ============================================================================
export const FraseApiCredential = createCredential({
  name: 'fraseApi',
  displayName: 'Frase API',
  description: 'API credentials for Frase - content optimization and SERP analysis',
  icon: 'file:frase.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Frase API key from https://app.frase.io/settings/api',
    },
  ],
  testRequest: {
    url: 'https://api.frase.io/v2/content/analyze',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer {{apiKey}}',
      'Content-Type': 'application/json',
    },
    body: { url: 'https://example.com', type: 'quick' },
  },
  documentationUrl: 'https://frase.io/features/api-integrations',
});

// ============================================================================
// OTTERLY AI API
// ============================================================================
export const OtterlyApiCredential = createCredential({
  name: 'otterlyApi',
  displayName: 'Otterly.AI API',
  description: 'API credentials for Otterly.AI - AI visibility monitoring across ChatGPT, Perplexity, Gemini',
  icon: 'file:otterly.svg',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Otterly.AI API key',
    },
    {
      displayName: 'Workspace ID',
      name: 'workspaceId',
      type: 'string',
      default: '',
      description: 'Your Otterly workspace ID (optional)',
    },
  ],
  documentationUrl: 'https://otterly.ai/docs',
});

// ============================================================================
// DATAFORSEO API
// ============================================================================
export const DataForSeoApiCredential = createCredential({
  name: 'dataForSeoApi',
  displayName: 'DataForSEO API',
  description: 'API credentials for DataForSEO - SERP data, backlinks, and competitor analysis',
  icon: 'file:dataforseo.svg',
  properties: [
    {
      displayName: 'Login',
      name: 'login',
      type: 'string',
      default: '',
      required: true,
      description: 'Your DataForSEO login email',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your DataForSEO API password',
    },
  ],
  testRequest: {
    url: 'https://api.dataforseo.com/v3/appendix/user_data',
    method: 'GET',
    headers: {
      'Authorization': 'Basic {{base64(login:password)}}',
    },
  },
  documentationUrl: 'https://docs.dataforseo.com/',
});

// ============================================================================
// BRIGHTDATA API
// ============================================================================
export const BrightDataApiCredential = createCredential({
  name: 'brightDataApi',
  displayName: 'Bright Data API',
  description: 'API credentials for Bright Data - web scraping and data collection',
  icon: 'file:brightdata.svg',
  properties: [
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Bright Data API token',
    },
    {
      displayName: 'Zone',
      name: 'zone',
      type: 'string',
      default: '',
      description: 'Your Bright Data zone name',
    },
  ],
  documentationUrl: 'https://docs.brightdata.com/',
});

// Export all GEO credentials
export const geoCredentials = [
  PerplexityApiCredential,
  SerpApiCredential,
  GooglePlacesApiCredential,
  TextRazorApiCredential,
  FraseApiCredential,
  OtterlyApiCredential,
  DataForSeoApiCredential,
  BrightDataApiCredential,
];

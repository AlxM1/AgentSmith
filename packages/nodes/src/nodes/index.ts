// Core Nodes
export * from './core';

// Trigger Nodes
export * from './triggers';

// AI Nodes
export * from './ai';

// Communication Nodes
export * from './communication';

// Productivity Nodes
export * from './productivity';

// Database Nodes
export * from './database';

// Ecommerce Nodes
export * from './ecommerce';

// CRM Nodes
export * from './crm';

// Vector Database Nodes
export * from './vectordb';

// Data Processing Nodes
export * from './data';

// Cloud Storage & Integrations
export * from './integrations';

// Developer Tools
export * from './developer';

// Social Media Nodes
export * from './social';

// Utility APIs
export * from './utilities';

// Web Scraping
export * from './scraping';

// Search APIs
export * from './search';

// AI Agents
export * from './agents';

// Re-export all node types for easy registration
import * as core from './core';
import * as triggers from './triggers';
import * as ai from './ai';
import * as communication from './communication';
import * as productivity from './productivity';
import * as database from './database';
import * as ecommerce from './ecommerce';
import * as crm from './crm';
import * as vectordb from './vectordb';
import * as data from './data';
import * as integrations from './integrations';
import * as developer from './developer';
import * as social from './social';
import * as utilities from './utilities';
import * as scraping from './scraping';
import * as search from './search';
import * as agents from './agents';

export const allNodes = {
  // Core
  HttpRequest: core.HttpRequest,
  Code: core.Code,
  Set: core.Set,
  If: core.If,
  Switch: core.Switch,
  Merge: core.Merge,
  SplitInBatches: core.SplitInBatches,
  Filter: core.Filter,
  Wait: core.Wait,
  DateTime: core.DateTime,
  Crypto: core.Crypto,
  JSON: core.JSON_Node,
  XML: core.XML,
  HTML: core.HTML,
  ErrorTrigger: core.ErrorTrigger,
  StopAndError: core.StopAndError,
  NoOp: core.NoOp,
  RespondToWebhook: core.RespondToWebhook,

  // Triggers
  Webhook: triggers.Webhook,
  Schedule: triggers.Schedule,
  ManualTrigger: triggers.ManualTrigger,

  // AI
  OpenAI: ai.OpenAI,
  Anthropic: ai.Anthropic,
  GoogleAI: ai.GoogleAI,
  OpenAIEmbeddings: ai.OpenAIEmbeddings,
  OpenAIVision: ai.OpenAIVision,
  OpenAIFunctionCalling: ai.OpenAIFunctionCalling,
  OpenAITextToSpeech: ai.OpenAITextToSpeech,
  AIAgent: ai.AIAgent,

  // Vector Databases
  Pinecone: vectordb.Pinecone,
  Qdrant: vectordb.Qdrant,

  // Communication
  Slack: communication.Slack,
  Discord: communication.Discord,
  Telegram: communication.Telegram,

  // Productivity
  Notion: productivity.Notion,
  GoogleSheets: productivity.GoogleSheets,
  Airtable: productivity.Airtable,
  Github: productivity.Github,

  // Database
  Postgres: database.Postgres,
  MySQL: database.MySQL,
  MongoDB: database.MongoDB,
  Redis: database.Redis,

  // Ecommerce
  Stripe: ecommerce.Stripe,
  Shopify: ecommerce.Shopify,

  // CRM
  HubSpot: crm.HubSpot,
  Salesforce: crm.Salesforce,

  // Data Processing
  Spreadsheet: data.Spreadsheet,
  Aggregate: data.Aggregate,
  Sort: data.Sort,
  Limit: data.Limit,
  RemoveDuplicates: data.RemoveDuplicates,
  RenameKeys: data.RenameKeys,

  // Cloud Storage & Integrations
  Gmail: integrations.Gmail,
  GoogleDrive: integrations.GoogleDrive,
  S3: integrations.S3,

  // Developer Tools
  GraphQL: developer.GraphQL,
  RSSFeed: developer.RSSFeed,
  FTP: developer.FTP,
  ExecuteCommand: developer.ExecuteCommand,
  SSHTunnel: developer.SSHTunnel,

  // Social Media (💚 = Free tier, 💰 = Paid)
  Twitter: social.Twitter,
  LinkedIn: social.LinkedIn,
  Facebook: social.Facebook,
  Instagram: social.Instagram,
  TikTok: social.TikTok,
  YouTube: social.YouTube,
  Reddit: social.Reddit,
  Pinterest: social.Pinterest,
  Mastodon: social.Mastodon,
  Bluesky: social.Bluesky,
  WhatsApp: social.WhatsApp,
  Threads: social.Threads,

  // Utility APIs - Weather (💚 = Free tier available)
  OpenWeatherMap: utilities.OpenWeatherMap,
  WeatherAPI: utilities.WeatherAPI,

  // Utility APIs - News
  NewsAPI: utilities.NewsAPI,
  GNews: utilities.GNews,

  // Utility APIs - Translation
  GoogleTranslate: utilities.GoogleTranslate,
  DeepL: utilities.DeepL,
  LibreTranslate: utilities.LibreTranslate,

  // Utility APIs - Maps & Geocoding
  GoogleMaps: utilities.GoogleMaps,
  Mapbox: utilities.Mapbox,
  OpenStreetMap: utilities.OpenStreetMap,

  // Utility APIs - General
  IPGeolocation: utilities.IPGeolocation,
  CurrencyExchange: utilities.CurrencyExchange,
  QRCode: utilities.QRCode,
  Screenshot: utilities.Screenshot,
  TextAnalysis: utilities.TextAnalysis,

  // URL Shorteners
  Bitly: utilities.Bitly,
  TinyURL: utilities.TinyURL,
  Rebrandly: utilities.Rebrandly,

  // File Conversion
  CloudConvert: utilities.CloudConvert,
  Convertio: utilities.Convertio,
  PDFco: utilities.PDFco,

  // Email Validation
  ZeroBounce: utilities.ZeroBounce,
  Hunter: utilities.Hunter,

  // SMS & Phone
  Twilio: utilities.Twilio,
  MessageBird: utilities.MessageBird,

  // Scheduling
  Calendly: utilities.Calendly,

  // Web Scraping
  Puppeteer: scraping.Puppeteer,
  HTMLParser: scraping.HTMLParser,
  ArticleExtractor: scraping.ArticleExtractor,
  ScrapingBee: scraping.ScrapingBee,
  BrightData: scraping.BrightData,
  ScraperAPI: scraping.ScraperAPI,
  PDFExtractor: scraping.PDFExtractor,
  OCR: scraping.OCR,
  WebMonitor: scraping.WebMonitor,

  // Specialized Scrapers
  JobBoardScraper: scraping.JobBoardScraper,
  ReviewAggregator: scraping.ReviewAggregator,
  PriceTracker: scraping.PriceTracker,
  RealEstateScraper: scraping.RealEstateScraper,
  SocialProfileScraper: scraping.SocialProfileScraper,
  NewsAggregator: scraping.NewsAggregator,

  // Search APIs
  SerpAPI: search.SerpAPI,
  BraveSearch: search.BraveSearch,
  DuckDuckGo: search.DuckDuckGo,
  BingSearch: search.BingSearch,
  Wikipedia: search.Wikipedia,
  ArXiv: search.ArXiv,
  HackerNews: search.HackerNews,
  ProductHunt: search.ProductHunt,
  GoogleTrends: search.GoogleTrends,

  // AI Agents
  ResearchAgent: agents.ResearchAgent,
  DataCollectorAgent: agents.DataCollectorAgent,
  ContentGeneratorAgent: agents.ContentGeneratorAgent,
  LeadEnrichmentAgent: agents.LeadEnrichmentAgent,
  CompetitorAnalysisAgent: agents.CompetitorAnalysisAgent,
  MonitoringAgent: agents.MonitoringAgent,
  WorkflowOrchestratorAgent: agents.WorkflowOrchestratorAgent,
};

export const nodeList = Object.values(allNodes);

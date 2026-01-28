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

// Re-export all node types for easy registration
import * as core from './core';
import * as triggers from './triggers';
import * as ai from './ai';
import * as communication from './communication';
import * as productivity from './productivity';
import * as database from './database';
import * as ecommerce from './ecommerce';
import * as crm from './crm';

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

  // Triggers
  Webhook: triggers.Webhook,
  Schedule: triggers.Schedule,
  ManualTrigger: triggers.ManualTrigger,

  // AI
  OpenAI: ai.OpenAI,
  Anthropic: ai.Anthropic,
  GoogleAI: ai.GoogleAI,

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
};

export const nodeList = Object.values(allNodes);

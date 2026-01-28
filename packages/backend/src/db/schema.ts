// Database Schema using Drizzle ORM

import { pgTable, varchar, text, timestamp, boolean, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'viewer']);
export const workflowStatusEnum = pgEnum('workflow_status', ['draft', 'active', 'inactive', 'error']);
export const executionStatusEnum = pgEnum('execution_status', ['pending', 'running', 'success', 'failed', 'cancelled', 'waiting']);
export const executionModeEnum = pgEnum('execution_mode', ['manual', 'trigger', 'webhook', 'retry', 'internal', 'cli']);

// Users table
export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  role: userRoleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  isPending: boolean('is_pending').notNull().default(false),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// Workflows table
export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  nodes: jsonb('nodes').notNull().default([]),
  connections: jsonb('connections').notNull().default([]),
  settings: jsonb('settings').notNull(),
  staticData: jsonb('static_data'),
  tags: jsonb('tags').notNull().default([]),
  status: workflowStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 50 }).notNull().references(() => users.id),
  updatedBy: varchar('updated_by', { length: 50 }).references(() => users.id),
});

// Executions table
export const executions = pgTable('executions', {
  id: varchar('id', { length: 50 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 50 }).notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  workflowName: varchar('workflow_name', { length: 255 }).notNull(),
  status: executionStatusEnum('status').notNull().default('pending'),
  mode: executionModeEnum('mode').notNull(),
  data: jsonb('data'),
  error: jsonb('error'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
  retryOf: varchar('retry_of', { length: 50 }),
  retrySuccessId: varchar('retry_success_id', { length: 50 }),
});

// Credentials table
export const credentials = pgTable('credentials', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  data: text('data').notNull(), // Encrypted JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 50 }).notNull().references(() => users.id),
});

// Credential shares table
export const credentialShares = pgTable('credential_shares', {
  id: varchar('id', { length: 50 }).primaryKey(),
  credentialId: varchar('credential_id', { length: 50 }).notNull().references(() => credentials.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 50 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessLevel: varchar('access_level', { length: 20 }).notNull().default('read'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Webhooks table
export const webhooks = pgTable('webhooks', {
  id: varchar('id', { length: 50 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 50 }).notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 50 }).notNull(),
  path: varchar('path', { length: 255 }).notNull().unique(),
  method: varchar('method', { length: 10 }).notNull().default('POST'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// API Keys table
export const apiKeys = pgTable('api_keys', {
  id: varchar('id', { length: 50 }).primaryKey(),
  userId: varchar('user_id', { length: 50 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
});

// Tags table
export const tags = pgTable('tags', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  color: varchar('color', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Workflow tags junction table
export const workflowTags = pgTable('workflow_tags', {
  workflowId: varchar('workflow_id', { length: 50 }).notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  tagId: varchar('tag_id', { length: 50 }).notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

// Variables table (for workflow variables)
export const variables = pgTable('variables', {
  id: varchar('id', { length: 50 }).primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('string'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Scheduled triggers table
export const scheduledTriggers = pgTable('scheduled_triggers', {
  id: varchar('id', { length: 50 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 50 }).notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 50 }).notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
  isActive: boolean('is_active').notNull().default(true),
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Execution data table (for large execution data)
export const executionData = pgTable('execution_data', {
  id: varchar('id', { length: 50 }).primaryKey(),
  executionId: varchar('execution_id', { length: 50 }).notNull().references(() => executions.id, { onDelete: 'cascade' }),
  data: text('data').notNull(), // Compressed JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Settings table
export const settings = pgTable('settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Audit log table
export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  userId: varchar('user_id', { length: 50 }).references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: varchar('resource_id', { length: 50 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  workflows: many(workflows),
  credentials: many(credentials),
  apiKeys: many(apiKeys),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  executions: many(executions),
  webhooks: many(webhooks),
  scheduledTriggers: many(scheduledTriggers),
}));

export const executionsRelations = relations(executions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [executions.workflowId],
    references: [workflows.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [credentials.createdBy],
    references: [users.id],
  }),
  shares: many(credentialShares),
}));

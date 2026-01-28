// Zod Schemas for Validation

import { z } from 'zod';

// Common schemas
export const idSchema = z.string().min(1);
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const dateSchema = z.coerce.date();

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// User schemas
export const userRoleSchema = z.enum(['admin', 'user', 'viewer']);

export const userCreateSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: userRoleSchema.optional().default('user'),
});

export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Workflow schemas
export const workflowStatusSchema = z.enum(['draft', 'active', 'inactive', 'error']);

export const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const nodeCredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const nodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  typeVersion: z.number().default(1),
  position: nodePositionSchema,
  parameters: z.record(z.unknown()).default({}),
  credentials: z.record(nodeCredentialSchema).optional(),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
  notesInFlow: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
  maxTries: z.number().optional(),
  waitBetweenTries: z.number().optional(),
  continueOnFail: z.boolean().optional(),
  onError: z.enum(['stopWorkflow', 'continueRegularOutput', 'continueErrorOutput']).optional(),
});

export const connectionSchema = z.object({
  source: z.string(),
  sourceHandle: z.string().optional(),
  target: z.string(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
});

export const workflowSettingsSchema = z.object({
  executionOrder: z.enum(['v1', 'v2']).default('v2'),
  saveExecutionProgress: z.boolean().default(true),
  saveManualExecutions: z.boolean().default(true),
  saveDataSuccessExecution: z.enum(['all', 'none']).default('all'),
  saveDataErrorExecution: z.enum(['all', 'none']).default('all'),
  timeout: z.number().default(3600),
  timezone: z.string().default('UTC'),
  errorWorkflow: z.string().optional(),
  callerPolicy: z.enum(['any', 'workflowsFromSameOwner', 'none']).default('workflowsFromSameOwner'),
});

export const workflowCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(nodeSchema).optional().default([]),
  connections: z.array(connectionSchema).optional().default([]),
  settings: workflowSettingsSchema.partial().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const workflowUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  nodes: z.array(nodeSchema).optional(),
  connections: z.array(connectionSchema).optional(),
  settings: workflowSettingsSchema.partial().optional(),
  tags: z.array(z.string()).optional(),
  status: workflowStatusSchema.optional(),
});

// Execution schemas
export const executionStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failed',
  'cancelled',
  'waiting',
]);

export const executionModeSchema = z.enum([
  'manual',
  'trigger',
  'webhook',
  'retry',
  'internal',
  'cli',
]);

export const executionFilterSchema = z.object({
  workflowId: z.string().optional(),
  status: z.array(executionStatusSchema).optional(),
  startedAfter: dateSchema.optional(),
  startedBefore: dateSchema.optional(),
});

// Credential schemas
export const credentialCreateSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()),
});

export const credentialUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  data: z.record(z.unknown()).optional(),
});

// Webhook schemas
export const webhookPayloadSchema = z.object({
  headers: z.record(z.string()),
  params: z.record(z.string()),
  query: z.record(z.string()),
  body: z.unknown(),
  method: z.string(),
  path: z.string(),
  webhookId: z.string(),
  workflowId: z.string(),
});

// Export types from schemas
export type PaginationInput = z.infer<typeof paginationSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;
export type ExecutionFilterInput = z.infer<typeof executionFilterSchema>;
export type CredentialCreateInput = z.infer<typeof credentialCreateSchema>;
export type CredentialUpdateInput = z.infer<typeof credentialUpdateSchema>;

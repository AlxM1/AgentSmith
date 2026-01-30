/**
 * Migration: Performance Indexes
 * Adds optimized indexes for production query performance
 */

import { sql } from 'drizzle-orm';

export async function up(db: any): Promise<void> {
  // ============================================
  // Workflows Table Indexes
  // ============================================

  // Index for listing workflows by user with status filter
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_user_status
    ON workflows (user_id, is_active, updated_at DESC);
  `);

  // Index for workflow name search
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_name_trgm
    ON workflows USING gin (name gin_trgm_ops);
  `);

  // Index for workspace scoping
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_workspace
    ON workflows (workspace_id, is_active) WHERE workspace_id IS NOT NULL;
  `);

  // Index for folder organization
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_folder
    ON workflows (folder_id, name) WHERE folder_id IS NOT NULL;
  `);

  // ============================================
  // Executions Table Indexes
  // ============================================

  // Primary execution lookup by workflow
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_workflow_date
    ON executions (workflow_id, started_at DESC);
  `);

  // Index for execution status filtering
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_status_date
    ON executions (status, started_at DESC);
  `);

  // Index for user's execution history
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_user_date
    ON executions (user_id, started_at DESC);
  `);

  // Index for running executions monitoring
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_running
    ON executions (workflow_id, started_at)
    WHERE status = 'running';
  `);

  // Index for failed executions (for retry logic)
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_failed
    ON executions (workflow_id, finished_at DESC)
    WHERE status = 'error';
  `);

  // Index for execution data cleanup
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_cleanup
    ON executions (finished_at)
    WHERE finished_at IS NOT NULL;
  `);

  // Composite index for dashboard queries
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_dashboard
    ON executions (user_id, status, started_at DESC)
    INCLUDE (workflow_id, finished_at);
  `);

  // ============================================
  // Credentials Table Indexes
  // ============================================

  // Index for credential lookup by user and type
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_user_type
    ON credentials (user_id, type, name);
  `);

  // Index for workspace credentials
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credentials_workspace
    ON credentials (workspace_id, type) WHERE workspace_id IS NOT NULL;
  `);

  // ============================================
  // Users Table Indexes
  // ============================================

  // Index for email lookup (unique, but adding for performance)
  await db.execute(sql`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower
    ON users (LOWER(email));
  `);

  // Index for user role filtering
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active
    ON users (role, is_active) WHERE is_active = true;
  `);

  // ============================================
  // Audit Log Indexes
  // ============================================

  // Index for audit log queries by user
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_date
    ON audit_logs (user_id, created_at DESC);
  `);

  // Index for audit log queries by resource
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource
    ON audit_logs (resource_type, resource_id, created_at DESC);
  `);

  // Index for action type filtering
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action, created_at DESC);
  `);

  // ============================================
  // Webhook Logs Indexes
  // ============================================

  // Index for webhook lookup
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_workflow
    ON webhook_logs (workflow_id, received_at DESC);
  `);

  // Index for webhook status filtering
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_status
    ON webhook_logs (status, received_at DESC);
  `);

  // ============================================
  // API Keys Indexes
  // ============================================

  // Index for API key hash lookup
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_hash
    ON api_keys (key_hash) WHERE is_active = true;
  `);

  // Index for user's API keys
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_user
    ON api_keys (user_id, is_active, created_at DESC);
  `);

  // ============================================
  // Workflow Versions Indexes
  // ============================================

  // Index for version history lookup
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_versions_workflow
    ON workflow_versions (workflow_id, version DESC);
  `);

  // ============================================
  // Tags Indexes (for workflow tagging)
  // ============================================

  // GIN index for tag array searches
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_tags
    ON workflows USING gin (tags) WHERE tags IS NOT NULL;
  `);

  // ============================================
  // Full-text Search Indexes
  // ============================================

  // Full-text search on workflow name and description
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_fts
    ON workflows USING gin (
      to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
    );
  `);

  // ============================================
  // Partial Indexes for Common Queries
  // ============================================

  // Active workflows only (most common query pattern)
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_active_only
    ON workflows (user_id, updated_at DESC)
    WHERE is_active = true AND deleted_at IS NULL;
  `);

  // Recent executions (last 7 days)
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_recent
    ON executions (workflow_id, status, started_at DESC)
    WHERE started_at > NOW() - INTERVAL '7 days';
  `);

  // ============================================
  // Statistics
  // ============================================

  // Update table statistics for query planner
  await db.execute(sql`ANALYZE workflows;`);
  await db.execute(sql`ANALYZE executions;`);
  await db.execute(sql`ANALYZE credentials;`);
  await db.execute(sql`ANALYZE users;`);
  await db.execute(sql`ANALYZE audit_logs;`);

  console.log('Performance indexes created successfully');
}

export async function down(db: any): Promise<void> {
  // Drop all indexes in reverse order
  const indexes = [
    'idx_executions_recent',
    'idx_workflows_active_only',
    'idx_workflows_fts',
    'idx_workflows_tags',
    'idx_workflow_versions_workflow',
    'idx_api_keys_user',
    'idx_api_keys_hash',
    'idx_webhook_logs_status',
    'idx_webhook_logs_workflow',
    'idx_audit_logs_action',
    'idx_audit_logs_resource',
    'idx_audit_logs_user_date',
    'idx_users_role_active',
    'idx_users_email_lower',
    'idx_credentials_workspace',
    'idx_credentials_user_type',
    'idx_executions_dashboard',
    'idx_executions_cleanup',
    'idx_executions_failed',
    'idx_executions_running',
    'idx_executions_user_date',
    'idx_executions_status_date',
    'idx_executions_workflow_date',
    'idx_workflows_folder',
    'idx_workflows_workspace',
    'idx_workflows_name_trgm',
    'idx_workflows_user_status',
  ];

  for (const index of indexes) {
    await db.execute(sql.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${index};`));
  }

  console.log('Performance indexes dropped');
}

export default { up, down };

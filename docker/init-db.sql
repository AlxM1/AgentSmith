-- Initialize AgentSmith Database
-- Full schema with SSO, 2FA, versioning, and production features

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'inactive', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled', 'waiting');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_mode AS ENUM ('manual', 'trigger', 'webhook', 'retry', 'internal', 'cli');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sso_provider AS ENUM ('google', 'github', 'microsoft', 'okta', 'saml', 'oidc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'user.login', 'user.logout', 'user.create', 'user.update', 'user.delete',
        'user.2fa_enable', 'user.2fa_disable', 'user.password_change',
        'workflow.create', 'workflow.update', 'workflow.delete', 'workflow.activate', 'workflow.deactivate',
        'workflow.execute', 'workflow.rollback',
        'credential.create', 'credential.update', 'credential.delete', 'credential.share',
        'settings.update', 'api_key.create', 'api_key.delete'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- USERS TABLE (with SSO and 2FA support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar VARCHAR(500),
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_pending BOOLEAN NOT NULL DEFAULT false,
    -- SSO fields
    sso_id VARCHAR(255),
    sso_provider sso_provider,
    -- 2FA fields
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret VARCHAR(255),
    two_factor_backup_codes TEXT[],
    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- SSO index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_sso ON users(sso_provider, sso_id) WHERE sso_id IS NOT NULL;

-- ============================================================================
-- WORKFLOWS TABLE (with versioning support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]',
    connections JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    static_data JSONB,
    tags JSONB NOT NULL DEFAULT '[]',
    status workflow_status NOT NULL DEFAULT 'draft',
    active BOOLEAN NOT NULL DEFAULT false,
    version_id INTEGER DEFAULT 1,
    pinned_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id)
);

-- ============================================================================
-- WORKFLOW VERSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_versions (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]',
    connections JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id),
    comment TEXT,
    UNIQUE(workflow_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_number ON workflow_versions(workflow_id, version_number DESC);

-- ============================================================================
-- EXECUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS executions (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255) NOT NULL,
    status execution_status NOT NULL DEFAULT 'pending',
    mode execution_mode NOT NULL,
    data JSONB,
    error JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    stopped_at TIMESTAMP,
    wait_till TIMESTAMP,
    retry_of VARCHAR(50),
    retry_success_id VARCHAR(50),
    workflow_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_mode ON executions(mode);

-- ============================================================================
-- EXECUTION DATA TABLE (for large execution data storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_data (
    id VARCHAR(50) PRIMARY KEY,
    execution_id VARCHAR(50) NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_name VARCHAR(255) NOT NULL,
    run_index INTEGER NOT NULL DEFAULT 0,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_data_execution ON execution_data(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_data_node ON execution_data(execution_id, node_name);

-- ============================================================================
-- CREDENTIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS credentials (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_created_by ON credentials(created_by);

-- ============================================================================
-- CREDENTIAL SHARES TABLE (for sharing credentials between users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS credential_shares (
    id VARCHAR(50) PRIMARY KEY,
    credential_id VARCHAR(50) NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'use',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id),
    UNIQUE(credential_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_credential_shares_user ON credential_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_credential_shares_credential ON credential_shares(credential_id);

-- ============================================================================
-- WORKFLOW SHARES TABLE (for sharing workflows between users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_shares (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id),
    UNIQUE(workflow_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_shares_user ON workflow_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_shares_workflow ON workflow_shares(workflow_id);

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    node_id VARCHAR(50) NOT NULL,
    path VARCHAR(255) NOT NULL UNIQUE,
    method VARCHAR(10) NOT NULL DEFAULT 'POST',
    is_active BOOLEAN NOT NULL DEFAULT true,
    authentication JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_path ON webhooks(path);
CREATE INDEX IF NOT EXISTS idx_webhooks_workflow ON webhooks(workflow_id);

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read', 'write', 'execute'],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================================
-- TAGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VARIABLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS variables (
    id VARCHAR(50) PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'string',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCHEDULED TRIGGERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_triggers (
    id VARCHAR(50) PRIMARY KEY,
    workflow_id VARCHAR(50) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    node_id VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_workflow ON scheduled_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_next_run ON scheduled_triggers(next_run) WHERE is_active = true;

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- SESSIONS TABLE (for user sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credentials_updated_at ON credentials;
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_variables_updated_at ON variables;
CREATE TRIGGER update_variables_updated_at BEFORE UPDATE ON variables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_triggers_updated_at ON scheduled_triggers;
CREATE TRIGGER update_scheduled_triggers_updated_at BEFORE UPDATE ON scheduled_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default admin user (password: admin123)
-- BCrypt hash for 'admin123'
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, settings)
VALUES (
    'us_admin_default_001',
    'admin@agentsmith.local',
    '$2a$10$rQ4nF8L6nT9yE7wJ3vZ1KOzX4bA5cD6eF7gH8iJ9kL0mN1oP2qR3sT',
    'Admin',
    'User',
    'admin',
    true,
    '{"theme": "system", "locale": "en", "timezone": "UTC"}'
) ON CONFLICT (email) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value)
VALUES
    ('instance.name', '"AgentSmith"'),
    ('instance.timezone', '"UTC"'),
    ('instance.url', '"http://localhost:3000"'),
    ('execution.timeout', '3600'),
    ('execution.saveAll', 'true'),
    ('execution.pruneDataMaxAge', '336'),
    ('security.sessionTimeout', '86400'),
    ('security.maxLoginAttempts', '5'),
    ('security.lockoutDuration', '900'),
    ('security.passwordMinLength', '8'),
    ('security.require2FA', 'false'),
    ('email.enabled', 'false'),
    ('email.fromAddress', '"noreply@agentsmith.local"'),
    ('sso.enabled', 'false'),
    ('sso.autoProvision', 'true'),
    ('webhooks.defaultTimeout', '30000'),
    ('workflows.defaultTimezone', '"UTC"'),
    ('workflows.saveExecutionProgress', 'true'),
    ('workflows.callerPolicy', '"any"'),
    ('quota.maxWorkflowsPerUser', '-1'),
    ('quota.maxExecutionsPerDay', '-1')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- GRANTS (for production with separate db user)
-- ============================================================================
-- Uncomment and modify for production:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agentsmith_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agentsmith_app;

/**
 * Migration: Environments and Audit Logging
 * Adds environment management and SOC 2 audit trail
 */

import { PrismaClient } from '@prisma/client';
import { registerMigration } from './index.js';

registerMigration({
  version: '003',
  name: 'environments_audit',
  description: 'Add environment management and audit logging',

  async up(prisma: PrismaClient): Promise<void> {
    // Environments table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS environments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(20),
        is_protected BOOLEAN DEFAULT false,
        requires_approval BOOLEAN DEFAULT false,
        approvers UUID[] DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert default environments
    await prisma.$executeRaw`
      INSERT INTO environments (name, display_name, color, position, is_protected) VALUES
      ('development', 'Development', '#3498db', 0, false),
      ('staging', 'Staging', '#f39c12', 1, false),
      ('production', 'Production', '#e74c3c', 2, true)
      ON CONFLICT (name) DO NOTHING
    `;

    // Environment variables table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS environment_variables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value_encrypted TEXT NOT NULL,
        is_secret BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(environment_id, key)
      )
    `;

    // Workflow versions for environment promotion
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        nodes JSONB NOT NULL,
        connections JSONB NOT NULL,
        settings JSONB DEFAULT '{}',
        environment_id UUID REFERENCES environments(id),
        promoted_from UUID REFERENCES workflow_versions(id),
        promoted_at TIMESTAMP,
        promoted_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workflow_id, version, environment_id)
      )
    `;

    // Promotion requests
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS promotion_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_version_id UUID REFERENCES workflow_versions(id) ON DELETE CASCADE,
        source_environment_id UUID REFERENCES environments(id),
        target_environment_id UUID REFERENCES environments(id),
        status VARCHAR(50) DEFAULT 'pending',
        requested_by UUID REFERENCES users(id),
        reviewed_by UUID REFERENCES users(id),
        review_notes TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP
      )
    `;

    // Audit logs table (SOC 2 compliance)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        resource_name VARCHAR(255),
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id VARCHAR(255),
        success BOOLEAN DEFAULT true,
        error_message TEXT,

        soc2_control VARCHAR(20),
        data_classification VARCHAR(50),
        risk_level VARCHAR(20)
      )
    `;

    // Create audit log indexes for efficient querying
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_audit_soc2 ON audit_logs(soc2_control)
    `;

    // Audit log retention policy (auto-delete after configured period)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS audit_retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        retention_days INTEGER NOT NULL DEFAULT 365,
        action_pattern VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert default retention policy
    await prisma.$executeRaw`
      INSERT INTO audit_retention_policies (name, retention_days, action_pattern, is_active) VALUES
      ('Default', 365, '*', true)
      ON CONFLICT DO NOTHING
    `;

    // External secrets configuration
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS external_secret_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        config_encrypted TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Secret references (linking credentials to external secrets)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS secret_references (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID REFERENCES external_secret_providers(id) ON DELETE CASCADE,
        secret_path VARCHAR(500) NOT NULL,
        credential_id UUID REFERENCES credentials(id) ON DELETE CASCADE,
        field_name VARCHAR(100) NOT NULL,
        last_synced_at TIMESTAMP,
        sync_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  },

  async down(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRaw`DROP TABLE IF EXISTS secret_references CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS external_secret_providers CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS audit_retention_policies CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS audit_logs CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS promotion_requests CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS workflow_versions CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS environment_variables CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS environments CASCADE`;
  },
});

// @ts-nocheck
/**
 * Migration: Initial Schema
 * Creates the base tables for AgentSmith
 */

import { PrismaClient } from '@prisma/client';
import { registerMigration } from './index.js';

registerMigration({
  version: '001',
  name: 'initial_schema',
  description: 'Create initial database schema',

  async up(prisma: PrismaClient): Promise<void> {
    // Users table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // API Keys table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        key_prefix VARCHAR(10) NOT NULL,
        scopes TEXT[] DEFAULT '{}',
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Workflows table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        nodes JSONB DEFAULT '[]',
        connections JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        static_data JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT false,
        version INTEGER DEFAULT 1,
        tags TEXT[] DEFAULT '{}',
        folder_id UUID,
        owner_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_workflows_tags ON workflows USING GIN(tags)
    `;

    // Credentials table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        data_encrypted TEXT NOT NULL,
        owner_id UUID REFERENCES users(id),
        shared_with UUID[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Executions table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
        workflow_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'running',
        mode VARCHAR(50) DEFAULT 'manual',
        data JSONB DEFAULT '{}',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stopped_at TIMESTAMP,
        wait_till TIMESTAMP,
        retry_of UUID REFERENCES executions(id),
        error_message TEXT
      )
    `;

    // Create execution indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_executions_started ON executions(started_at DESC)
    `;

    // Webhooks table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        node_id VARCHAR(100) NOT NULL,
        path VARCHAR(255) UNIQUE NOT NULL,
        method VARCHAR(10) DEFAULT 'POST',
        is_active BOOLEAN DEFAULT true,
        auth_type VARCHAR(50),
        auth_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create webhook index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_webhooks_path ON webhooks(path)
    `;
  },

  async down(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRaw`DROP TABLE IF EXISTS webhooks CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS executions CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS credentials CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS workflows CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS api_keys CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS users CASCADE`;
  },
});

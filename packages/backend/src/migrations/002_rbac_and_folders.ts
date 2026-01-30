/**
 * Migration: RBAC and Folder System
 * Adds role-based access control and workflow folders
 */

import { PrismaClient } from '@prisma/client';
import { registerMigration } from './index.js';

registerMigration({
  version: '002',
  name: 'rbac_and_folders',
  description: 'Add RBAC system and workflow folders',

  async up(prisma: PrismaClient): Promise<void> {
    // Roles table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}',
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert default roles
    await prisma.$executeRaw`
      INSERT INTO roles (name, display_name, description, permissions, is_system) VALUES
      ('admin', 'Administrator', 'Full system access', '{"*": true}', true),
      ('editor', 'Editor', 'Can create and edit workflows', '{"workflow:create": true, "workflow:read": true, "workflow:update": true, "workflow:execute": true, "credential:create": true, "credential:read": true}', true),
      ('operator', 'Operator', 'Can execute and monitor workflows', '{"workflow:read": true, "workflow:execute": true, "execution:read": true}', true),
      ('viewer', 'Viewer', 'Read-only access', '{"workflow:read": true, "execution:read": true}', true)
      ON CONFLICT (name) DO NOTHING
    `;

    // User roles junction table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        scope VARCHAR(100) DEFAULT 'global',
        scope_id UUID,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        granted_by UUID REFERENCES users(id),
        PRIMARY KEY (user_id, role_id, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'))
      )
    `;

    // Workflow folders table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS workflow_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        parent_id UUID REFERENCES workflow_folders(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES users(id),
        color VARCHAR(20),
        icon VARCHAR(50),
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, parent_id)
      )
    `;

    // Add folder_id foreign key to workflows
    await prisma.$executeRaw`
      ALTER TABLE workflows
      ADD CONSTRAINT fk_workflows_folder
      FOREIGN KEY (folder_id) REFERENCES workflow_folders(id) ON DELETE SET NULL
    `;

    // Create folder indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON workflow_folders(parent_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_workflows_folder ON workflows(folder_id)
    `;

    // Workflow sharing table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS workflow_shares (
        workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(50) DEFAULT 'read',
        shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        shared_by UUID REFERENCES users(id),
        PRIMARY KEY (workflow_id, user_id)
      )
    `;

    // Teams table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Team members
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (team_id, user_id)
      )
    `;
  },

  async down(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRaw`DROP TABLE IF EXISTS team_members CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS teams CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS workflow_shares CASCADE`;
    await prisma.$executeRaw`ALTER TABLE workflows DROP CONSTRAINT IF EXISTS fk_workflows_folder`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS workflow_folders CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS user_roles CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS roles CASCADE`;
  },
});

/**
 * Database Migrations System
 * Manages schema versioning and data migrations
 */

import { PrismaClient } from '@prisma/client';

export interface Migration {
  version: string;
  name: string;
  description?: string;
  up: (prisma: PrismaClient) => Promise<void>;
  down: (prisma: PrismaClient) => Promise<void>;
}

// Migration registry
export const migrations: Migration[] = [];

// Migration runner
export class MigrationRunner {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async initialize(): Promise<void> {
    // Ensure migrations table exists
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  async getAppliedMigrations(): Promise<string[]> {
    const results = await this.prisma.$queryRaw<{ version: string }[]>`
      SELECT version FROM _migrations ORDER BY applied_at ASC
    `;
    return results.map(r => r.version);
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    return migrations.filter(m => !applied.includes(m.version));
  }

  async runMigration(migration: Migration): Promise<void> {
    console.log(`Running migration ${migration.version}: ${migration.name}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await migration.up(tx as PrismaClient);

        await tx.$executeRaw`
          INSERT INTO _migrations (version, name) VALUES (${migration.version}, ${migration.name})
        `;
      });

      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await migration.down(tx as PrismaClient);

        await tx.$executeRaw`
          DELETE FROM _migrations WHERE version = ${migration.version}
        `;
      });

      console.log(`Rollback of ${migration.version} completed successfully`);
    } catch (error) {
      console.error(`Rollback of ${migration.version} failed:`, error);
      throw error;
    }
  }

  async migrateUp(targetVersion?: string): Promise<void> {
    await this.initialize();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    for (const migration of pending) {
      if (targetVersion && migration.version > targetVersion) {
        break;
      }
      await this.runMigration(migration);
    }
  }

  async migrateDown(targetVersion?: string): Promise<void> {
    await this.initialize();

    const applied = await this.getAppliedMigrations();
    const toRollback = migrations
      .filter(m => applied.includes(m.version))
      .filter(m => !targetVersion || m.version > targetVersion)
      .reverse();

    if (toRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    for (const migration of toRollback) {
      await this.rollbackMigration(migration);
    }
  }

  async status(): Promise<{
    applied: { version: string; name: string }[];
    pending: { version: string; name: string }[];
  }> {
    await this.initialize();

    const appliedVersions = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      applied: migrations
        .filter(m => appliedVersions.includes(m.version))
        .map(m => ({ version: m.version, name: m.name })),
      pending: pending.map(m => ({ version: m.version, name: m.name })),
    };
  }
}

// Register a migration
export function registerMigration(migration: Migration): void {
  migrations.push(migration);
  // Sort by version
  migrations.sort((a, b) => a.version.localeCompare(b.version));
}

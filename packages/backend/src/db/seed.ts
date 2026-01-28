// Database Seed Script

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { users, workflows, tags } from './schema.js';
import { logger } from '../lib/logger.js';
import { generateUserId, generateWorkflowId, generateId } from '@agentsmith/shared';
import { defaultWorkflowSettings } from '@agentsmith/shared';

async function seed() {
  logger.info('Starting database seeding...');

  try {
    // Create admin user
    const adminId = generateUserId();
    const passwordHash = await bcrypt.hash('admin123', 10);

    await db.insert(users).values({
      id: adminId,
      email: 'admin@agentsmith.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      isPending: false,
      settings: {
        theme: 'system',
        locale: 'en',
        timezone: 'UTC',
      },
    }).onConflictDoNothing();

    logger.info('Created admin user: admin@agentsmith.local / admin123');

    // Create sample tags
    const tagIds = {
      production: generateId(16),
      development: generateId(16),
      automation: generateId(16),
    };

    await db.insert(tags).values([
      { id: tagIds.production, name: 'Production', color: '#22c55e' },
      { id: tagIds.development, name: 'Development', color: '#3b82f6' },
      { id: tagIds.automation, name: 'Automation', color: '#8b5cf6' },
    ]).onConflictDoNothing();

    // Create sample workflow
    const workflowId = generateWorkflowId();

    await db.insert(workflows).values({
      id: workflowId,
      name: 'Sample Hello World Workflow',
      description: 'A simple workflow that demonstrates the basic structure',
      nodes: [
        {
          id: 'nd_trigger_1',
          name: 'Manual Trigger',
          type: 'agentsmith.manualTrigger',
          typeVersion: 1,
          position: { x: 100, y: 200 },
          parameters: {},
        },
        {
          id: 'nd_set_1',
          name: 'Set Message',
          type: 'agentsmith.set',
          typeVersion: 1,
          position: { x: 350, y: 200 },
          parameters: {
            values: {
              string: [
                {
                  name: 'message',
                  value: 'Hello from AgentSmith!',
                },
              ],
            },
          },
        },
      ],
      connections: [
        {
          source: 'nd_trigger_1',
          target: 'nd_set_1',
        },
      ],
      settings: defaultWorkflowSettings,
      tags: ['Development', 'Automation'],
      status: 'draft',
      createdBy: adminId,
    }).onConflictDoNothing();

    logger.info('Created sample workflow');
    logger.info('Database seeding completed successfully');

  } catch (error) {
    logger.error('Seeding failed:', { error });
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

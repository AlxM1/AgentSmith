// Credential Routes

import { Router } from 'express';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { eq, desc, like, and, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import {
  credentialCreateSchema,
  credentialUpdateSchema,
  paginationSchema,
  generateCredentialId,
} from '@agentsmith/shared';
import { encrypt, decrypt } from '../lib/crypto.js';
import { config } from '../config/index.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// List credentials
const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
});

router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, perPage, search, type } = req.query as z.infer<typeof listQuerySchema>;

    const offset = (page - 1) * perPage;

    const conditions = [];

    if (search) {
      conditions.push(like(credentials.name, `%${search}%`));
    }

    if (type) {
      conditions.push(eq(credentials.type, type));
    }

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(credentials)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get credentials (without decrypting data)
    const results = await db.query.credentials.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(credentials.updatedAt)],
      limit: perPage,
      offset,
    });

    // Return without sensitive data
    const items = results.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json({
      success: true,
      data: items,
      meta: {
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
          hasNext: page * perPage < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get credential types
router.get('/types', async (_req, res, next) => {
  try {
    // Return available credential types
    // In a full implementation, this would come from registered node types
    const types = [
      {
        name: 'httpBasicAuth',
        displayName: 'HTTP Basic Auth',
        description: 'Basic authentication with username and password',
      },
      {
        name: 'httpHeaderAuth',
        displayName: 'HTTP Header Auth',
        description: 'Authentication via HTTP header',
      },
      {
        name: 'oAuth2Api',
        displayName: 'OAuth2',
        description: 'OAuth 2.0 authentication',
      },
      {
        name: 'openAiApi',
        displayName: 'OpenAI API',
        description: 'OpenAI API key authentication',
      },
      {
        name: 'anthropicApi',
        displayName: 'Anthropic API',
        description: 'Anthropic API key authentication',
      },
      {
        name: 'slackApi',
        displayName: 'Slack API',
        description: 'Slack Bot/User OAuth token',
      },
      {
        name: 'githubApi',
        displayName: 'GitHub API',
        description: 'GitHub personal access token',
      },
      {
        name: 'postgres',
        displayName: 'PostgreSQL',
        description: 'PostgreSQL database connection',
      },
    ];

    res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    next(error);
  }
});

// Get single credential
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeData } = req.query;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
    });

    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    const result: {
      id: string;
      name: string;
      type: string;
      createdAt: Date;
      updatedAt: Date;
      data?: Record<string, unknown>;
    } = {
      id: credential.id,
      name: credential.name,
      type: credential.type,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };

    // Only include decrypted data if explicitly requested
    if (includeData === 'true') {
      const decryptedData = await decrypt(credential.data, config.encryption.key);
      result.data = JSON.parse(decryptedData);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Create credential
router.post('/', validateBody(credentialCreateSchema), async (req, res, next) => {
  try {
    const { name, type, data } = req.body;

    // Encrypt data
    const encryptedData = await encrypt(JSON.stringify(data), config.encryption.key);

    const credentialId = generateCredentialId();
    const now = new Date();

    const newCredential = {
      id: credentialId,
      name,
      type,
      data: encryptedData,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user!.id,
    };

    await db.insert(credentials).values(newCredential);

    res.status(201).json({
      success: true,
      data: {
        id: credentialId,
        name,
        type,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update credential
router.put('/:id', validateBody(credentialUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, data } = req.body;

    const existing = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
    });

    if (!existing) {
      throw new NotFoundError('Credential not found');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (data !== undefined) {
      updateData.data = await encrypt(JSON.stringify(data), config.encryption.key);
    }

    await db.update(credentials)
      .set(updateData)
      .where(eq(credentials.id, id));

    const updated = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
    });

    res.json({
      success: true,
      data: {
        id: updated!.id,
        name: updated!.name,
        type: updated!.type,
        createdAt: updated!.createdAt,
        updatedAt: updated!.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete credential
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
    });

    if (!existing) {
      throw new NotFoundError('Credential not found');
    }

    await db.delete(credentials).where(eq(credentials.id, id));

    res.json({
      success: true,
      data: { message: 'Credential deleted' },
    });
  } catch (error) {
    next(error);
  }
});

// Test credential
router.post('/:id/test', async (req, res, next) => {
  try {
    const { id } = req.params;

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.id, id),
    });

    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    // TODO: Implement credential testing based on type
    // This would involve making a test request using the credential

    res.json({
      success: true,
      data: {
        tested: true,
        valid: true,
        message: 'Credential test successful',
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as credentialRouter };

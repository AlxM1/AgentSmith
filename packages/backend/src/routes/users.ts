// User Routes

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, desc, like, and, sql } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import {
  userCreateSchema,
  userUpdateSchema,
  paginationSchema,
  generateUserId,
  defaultUserSettings,
} from '@agentsmith/shared';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// List users (admin only)
const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  isActive: z.coerce.boolean().optional(),
});

router.get('/', requireAdmin, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, perPage, search, role, isActive } = req.query as z.infer<typeof listQuerySchema>;

    const offset = (page - 1) * perPage;

    const conditions = [];

    if (search) {
      conditions.push(like(users.email, `%${search}%`));
    }

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0].count);

    // Get users
    const results = await db.query.users.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(users.createdAt)],
      limit: perPage,
      offset,
    });

    const items = results.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      isPending: u.isPending,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
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

// Get single user
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Users can only view themselves unless admin
    if (id !== req.user!.id && req.user!.role !== 'admin') {
      throw new NotFoundError('User not found');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        isPending: user.isPending,
        settings: user.settings,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
router.post('/', requireAdmin, validateBody(userCreateSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Check if email exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new ConflictError('Email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = generateUserId();
    const now = new Date();

    const newUser = {
      id: userId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || 'user',
      isActive: true,
      isPending: false,
      settings: defaultUserSettings,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        email,
        firstName,
        lastName,
        role: role || 'user',
        isActive: true,
        createdAt: now,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/:id', validateBody(userUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Users can only update themselves unless admin
    if (id !== req.user!.id && req.user!.role !== 'admin') {
      throw new NotFoundError('User not found');
    }

    // Non-admins cannot change their own role
    if (data.role && req.user!.role !== 'admin') {
      delete data.role;
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // Check email uniqueness if changing
    if (data.email && data.email !== existing.email) {
      const emailExists = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      });
      if (emailExists) {
        throw new ConflictError('Email already exists');
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.settings !== undefined) {
      updateData.settings = { ...(existing.settings as object || {}), ...data.settings };
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, id));

    const updated = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    res.json({
      success: true,
      data: {
        id: updated!.id,
        email: updated!.email,
        firstName: updated!.firstName,
        lastName: updated!.lastName,
        role: updated!.role,
        isActive: updated!.isActive,
        settings: updated!.settings,
        updatedAt: updated!.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cannot delete self
    if (id === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete your own account' },
      });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      throw new NotFoundError('User not found');
    }

    await db.delete(users).where(eq(users.id, id));

    res.json({
      success: true,
      data: { message: 'User deleted' },
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };

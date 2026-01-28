// Webhook Routes

import { Router } from 'express';
import { db } from '../db/index.js';
import { webhooks, workflows } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import type { IWebhookPayload } from '@agentsmith/shared';

const router = Router();

// Handle all webhook methods for a given path
const handleWebhook = async (req: any, res: any) => {
  try {
    const { path } = req.params;
    const webhookPath = `/${path}`;

    logger.info(`Webhook received: ${req.method} ${webhookPath}`);

    // Find webhook
    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.path, webhookPath),
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { message: 'Webhook not found' },
      });
    }

    if (!webhook.isActive) {
      return res.status(404).json({
        success: false,
        error: { message: 'Webhook is not active' },
      });
    }

    // Check method
    if (webhook.method !== 'ALL' && webhook.method !== req.method) {
      return res.status(405).json({
        success: false,
        error: { message: `Method ${req.method} not allowed` },
      });
    }

    // Get workflow
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, webhook.workflowId),
    });

    if (!workflow || workflow.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: { message: 'Workflow not found or not active' },
      });
    }

    // Build webhook payload
    const payload: IWebhookPayload = {
      headers: req.headers as Record<string, string>,
      params: req.params,
      query: req.query,
      body: req.body,
      method: req.method,
      path: webhookPath,
      webhookId: webhook.id,
      workflowId: webhook.workflowId,
    };

    // TODO: Queue workflow execution with the webhook payload
    logger.info(`Webhook triggered workflow: ${workflow.id}`);

    // For now, return success
    // In production, this might return the workflow response or wait for it
    res.json({
      success: true,
      data: {
        message: 'Webhook processed',
        executionId: `ex_${Date.now()}`,
      },
    });
  } catch (error) {
    logger.error('Webhook error:', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
};

// Catch-all routes for webhooks
router.get('/:path(*)', handleWebhook);
router.post('/:path(*)', handleWebhook);
router.put('/:path(*)', handleWebhook);
router.patch('/:path(*)', handleWebhook);
router.delete('/:path(*)', handleWebhook);
router.head('/:path(*)', handleWebhook);
router.options('/:path(*)', handleWebhook);

export { router as webhookRouter };

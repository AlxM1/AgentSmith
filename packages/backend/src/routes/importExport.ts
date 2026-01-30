/**
 * Workflow Import/Export Routes
 *
 * API endpoints for workflow portability:
 * - Export workflows as JSON
 * - Import workflows from JSON
 * - Bulk export/import
 * - n8n format compatibility
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { workflows, credentials, workflowVersions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { rbacService } from '../services/RBACService.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// TYPES
// ============================================================================

interface ExportedWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: any[];
  connections: any[];
  settings: any;
  tags?: string[];
  active: boolean;
  versionId?: number;
  _meta: {
    exportedAt: string;
    exportedBy?: string;
    agentsmithVersion: string;
    format: 'agentsmith' | 'n8n';
  };
}

interface ExportedCredential {
  id: string;
  name: string;
  type: string;
  // Data is NOT exported for security
  _meta: {
    exportedAt: string;
    note: string;
  };
}

interface ImportResult {
  success: boolean;
  workflowId?: string;
  workflowName?: string;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// EXPORT ROUTES
// ============================================================================

/**
 * GET /import-export/export/:id
 * Export a single workflow
 */
router.get('/export/:id', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'workflow:export', req.params.id);

    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, req.params.id),
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const format = req.query.format === 'n8n' ? 'n8n' : 'agentsmith';
    const exported = formatWorkflowForExport(workflow, format, req.user!.id);

    // Set headers for file download
    const filename = `${workflow.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exported);
  } catch (error: any) {
    logger.error('Failed to export workflow', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /import-export/export/bulk
 * Export multiple workflows
 */
router.post('/export/bulk', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'workflow:export');

    const { workflowIds } = req.body;

    if (!Array.isArray(workflowIds) || workflowIds.length === 0) {
      return res.status(400).json({ error: 'workflowIds array is required' });
    }

    const workflowList = await db.query.workflows.findMany({
      where: inArray(workflows.id, workflowIds),
    });

    const format = req.query.format === 'n8n' ? 'n8n' : 'agentsmith';
    const exported = workflowList.map((w) => formatWorkflowForExport(w, format, req.user!.id));

    const filename = `agentsmith_workflows_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json({
      workflows: exported,
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user!.id,
        count: exported.length,
        agentsmithVersion: process.env.npm_package_version || '1.0.0',
      },
    });
  } catch (error: any) {
    logger.error('Failed to bulk export workflows', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * GET /import-export/export/all
 * Export all workflows (admin only)
 */
router.get('/export/all', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'admin:backup');

    const workflowList = await db.query.workflows.findMany();
    const format = req.query.format === 'n8n' ? 'n8n' : 'agentsmith';

    const exported = workflowList.map((w) => formatWorkflowForExport(w, format, req.user!.id));

    const filename = `agentsmith_full_export_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json({
      workflows: exported,
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user!.id,
        count: exported.length,
        agentsmithVersion: process.env.npm_package_version || '1.0.0',
        type: 'full_backup',
      },
    });
  } catch (error: any) {
    logger.error('Failed to export all workflows', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * GET /import-export/credentials/list
 * List credentials for export reference (no sensitive data)
 */
router.get('/credentials/list', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'credential:read');

    const credentialList = await db.query.credentials.findMany({
      where: eq(credentials.createdBy, req.user!.id),
    });

    const exported: ExportedCredential[] = credentialList.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      _meta: {
        exportedAt: new Date().toISOString(),
        note: 'Credential data is not exported for security. Re-create credentials after import.',
      },
    }));

    res.json(exported);
  } catch (error: any) {
    logger.error('Failed to list credentials for export', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// IMPORT ROUTES
// ============================================================================

/**
 * POST /import-export/import
 * Import a single workflow
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'workflow:import');

    const workflow = req.body;
    const result = await importWorkflow(workflow, req.user!.id, req.query);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Failed to import workflow', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /import-export/import/bulk
 * Import multiple workflows
 */
router.post('/import/bulk', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'workflow:import');

    const { workflows: workflowList } = req.body;

    if (!Array.isArray(workflowList)) {
      return res.status(400).json({ error: 'workflows array is required' });
    }

    const results: ImportResult[] = [];

    for (const workflow of workflowList) {
      const result = await importWorkflow(workflow, req.user!.id, req.query);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    res.status(successCount > 0 ? 201 : 400).json({
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failureCount,
      },
    });
  } catch (error: any) {
    logger.error('Failed to bulk import workflows', { error: error.message });
    res.status(error.message.includes('Permission') ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /import-export/import/n8n
 * Import n8n format workflow
 */
router.post('/import/n8n', async (req: Request, res: Response) => {
  try {
    await rbacService.requirePermission(req.user!.id, 'workflow:import');

    const n8nWorkflow = req.body;
    const converted = convertN8nToAgentsmith(n8nWorkflow);
    const result = await importWorkflow(converted, req.user!.id, req.query);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Failed to import n8n workflow', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /import-export/validate
 * Validate workflow before import
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const workflow = req.body;
    const validation = validateWorkflow(workflow);

    res.json(validation);
  } catch (error: any) {
    logger.error('Failed to validate workflow', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatWorkflowForExport(
  workflow: any,
  format: 'agentsmith' | 'n8n',
  exportedBy?: string
): ExportedWorkflow {
  if (format === 'n8n') {
    // Convert to n8n format
    return {
      id: workflow.id,
      name: workflow.name,
      nodes: (workflow.nodes || []).map((node: any) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: 1,
        position: node.position,
        parameters: node.parameters || {},
        credentials: node.credentials,
      })),
      connections: convertConnectionsToN8n(workflow.connections || []),
      settings: workflow.settings || {},
      active: workflow.active,
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy,
        agentsmithVersion: process.env.npm_package_version || '1.0.0',
        format: 'n8n',
      },
    } as any;
  }

  // AgentSmith native format
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    nodes: workflow.nodes || [],
    connections: workflow.connections || [],
    settings: workflow.settings || {},
    tags: workflow.tags || [],
    active: workflow.active,
    versionId: workflow.versionId,
    _meta: {
      exportedAt: new Date().toISOString(),
      exportedBy,
      agentsmithVersion: process.env.npm_package_version || '1.0.0',
      format: 'agentsmith',
    },
  };
}

async function importWorkflow(
  workflow: any,
  userId: string,
  options: any
): Promise<ImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate
  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }
  warnings.push(...validation.warnings);

  try {
    // Generate new ID or use existing based on options
    const newId = options.preserveIds === 'true' && workflow.id
      ? workflow.id
      : `wf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Check if ID already exists
    if (options.preserveIds === 'true' && workflow.id) {
      const existing = await db.query.workflows.findFirst({
        where: eq(workflows.id, workflow.id),
      });

      if (existing) {
        if (options.overwrite === 'true') {
          // Update existing
          await db.update(workflows)
            .set({
              name: workflow.name,
              description: workflow.description,
              nodes: workflow.nodes,
              connections: workflow.connections,
              settings: workflow.settings || {},
              tags: workflow.tags || [],
              active: false, // Don't activate on import
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(workflows.id, workflow.id));

          return {
            success: true,
            workflowId: workflow.id,
            workflowName: workflow.name,
            warnings: [...warnings, 'Existing workflow was overwritten'],
          };
        } else {
          return {
            success: false,
            errors: [`Workflow with ID ${workflow.id} already exists. Use overwrite=true to replace.`],
          };
        }
      }
    }

    // Create new workflow
    await db.insert(workflows).values({
      id: newId,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes || [],
      connections: workflow.connections || [],
      settings: workflow.settings || {},
      tags: workflow.tags || [],
      status: 'draft',
      active: false,
      versionId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    // Create initial version
    await db.insert(workflowVersions).values({
      id: `wfv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workflowId: newId,
      versionNumber: 1,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes || [],
      connections: workflow.connections || [],
      settings: workflow.settings || {},
      active: false,
      createdAt: new Date(),
      createdBy: userId,
      comment: 'Imported workflow',
    });

    logger.info('Workflow imported', { workflowId: newId, name: workflow.name });

    return {
      success: true,
      workflowId: newId,
      workflowName: workflow.name,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    logger.error('Import failed', { error: error.message });
    return {
      success: false,
      errors: [error.message],
    };
  }
}

function validateWorkflow(workflow: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!workflow.name) {
    errors.push('Workflow name is required');
  }

  if (!workflow.nodes) {
    errors.push('Workflow nodes are required');
  } else if (!Array.isArray(workflow.nodes)) {
    errors.push('Workflow nodes must be an array');
  }

  // Validate nodes
  if (Array.isArray(workflow.nodes)) {
    for (let i = 0; i < workflow.nodes.length; i++) {
      const node = workflow.nodes[i];

      if (!node.id) {
        errors.push(`Node at index ${i} is missing an ID`);
      }

      if (!node.type) {
        errors.push(`Node ${node.id || i} is missing a type`);
      }

      // Check for credential references
      if (node.credentials) {
        warnings.push(`Node ${node.name || node.id} references credentials that may need to be reconfigured`);
      }
    }
  }

  // Validate connections
  if (workflow.connections && !Array.isArray(workflow.connections)) {
    errors.push('Workflow connections must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function convertConnectionsToN8n(connections: any[]): any {
  // Convert AgentSmith connection format to n8n format
  const n8nConnections: any = {};

  for (const conn of connections) {
    const sourceNode = conn.source?.node || conn.sourceNode;
    const targetNode = conn.target?.node || conn.targetNode;

    if (!sourceNode || !targetNode) continue;

    if (!n8nConnections[sourceNode]) {
      n8nConnections[sourceNode] = { main: [[]] };
    }

    n8nConnections[sourceNode].main[0].push({
      node: targetNode,
      type: 'main',
      index: 0,
    });
  }

  return n8nConnections;
}

function convertN8nToAgentsmith(n8nWorkflow: any): any {
  // Convert n8n format to AgentSmith format
  const nodes = (n8nWorkflow.nodes || []).map((node: any) => ({
    id: node.id || `node_${crypto.randomBytes(4).toString('hex')}`,
    type: node.type,
    name: node.name,
    position: node.position,
    parameters: node.parameters || {},
    credentials: node.credentials,
  }));

  // Convert connections
  const connections: any[] = [];
  const n8nConnections = n8nWorkflow.connections || {};

  for (const [sourceNode, outputs] of Object.entries(n8nConnections)) {
    const mainOutputs = (outputs as any).main || [];

    for (let outputIndex = 0; outputIndex < mainOutputs.length; outputIndex++) {
      const outputConnections = mainOutputs[outputIndex] || [];

      for (const conn of outputConnections) {
        connections.push({
          source: { node: sourceNode, port: 'output' },
          target: { node: conn.node, port: 'input' },
        });
      }
    }
  }

  return {
    name: n8nWorkflow.name,
    description: n8nWorkflow.description,
    nodes,
    connections,
    settings: n8nWorkflow.settings || {},
    tags: n8nWorkflow.tags || [],
    active: false,
    _meta: {
      importedFrom: 'n8n',
      originalId: n8nWorkflow.id,
    },
  };
}

export { router as importExportRouter };

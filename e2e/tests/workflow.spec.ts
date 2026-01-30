/**
 * Workflow E2E Tests
 */

import { test, expect, generateWorkflowName, workflowTemplates } from '../support/fixtures.js';

test.describe('Workflow Management', () => {
  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.navigate();
  });

  test('should display workflow list', async ({ page }) => {
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-workflow-button"]')).toBeVisible();
  });

  test('should create a new workflow', async ({ page, workflowPage }) => {
    const workflowName = generateWorkflowName();

    await workflowPage.createWorkflow(workflowName);

    // Verify we're on the workflow editor
    await expect(page).toHaveURL(/.*workflow\/.*/);
    await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
  });

  test('should edit workflow name', async ({ page, apiHelper }) => {
    // Create workflow via API first
    const workflow = await apiHelper.createWorkflow({
      name: generateWorkflowName(),
      nodes: [],
      connections: {},
    });

    await page.goto(`/workflow/${workflow.id}`);

    // Click on workflow name to edit
    await page.click('[data-testid="workflow-name-display"]');
    await page.fill('[data-testid="workflow-name-input"]', 'Updated Workflow Name');
    await page.press('[data-testid="workflow-name-input"]', 'Enter');

    // Verify the name was updated
    await expect(page.locator('[data-testid="workflow-name-display"]'))
      .toHaveText('Updated Workflow Name');

    // Cleanup
    await apiHelper.deleteWorkflow(workflow.id);
  });

  test('should add nodes to workflow', async ({ page, workflowPage }) => {
    const workflowName = generateWorkflowName();
    await workflowPage.createWorkflow(workflowName);

    // Add a Manual Trigger node
    await workflowPage.addNode('manualTrigger');

    // Verify node was added
    await expect(page.locator('[data-testid="node-manualTrigger"]')).toBeVisible();

    // Add an HTTP Request node
    await workflowPage.addNode('httpRequest');

    // Verify second node was added
    await expect(page.locator('[data-testid="node-httpRequest"]')).toBeVisible();
  });

  test('should connect nodes', async ({ page, workflowPage }) => {
    const workflowName = generateWorkflowName();
    await workflowPage.createWorkflow(workflowName);

    await workflowPage.addNode('manualTrigger');
    await workflowPage.addNode('httpRequest');

    // Connect the nodes
    await workflowPage.connectNodes('manualTrigger', 'httpRequest');

    // Verify connection exists
    await expect(page.locator('[data-testid="connection-line"]')).toBeVisible();
  });

  test('should save workflow', async ({ page, workflowPage }) => {
    const workflowName = generateWorkflowName();
    await workflowPage.createWorkflow(workflowName);

    await workflowPage.addNode('manualTrigger');
    await workflowPage.saveWorkflow();

    // Refresh page and verify workflow was saved
    await page.reload();
    await expect(page.locator('[data-testid="node-manualTrigger"]')).toBeVisible();
  });

  test('should delete workflow', async ({ page, workflowPage, apiHelper }) => {
    // Create workflow via API
    const workflow = await apiHelper.createWorkflow({
      name: generateWorkflowName(),
      nodes: [],
      connections: {},
    });

    await workflowPage.navigate();

    // Delete the workflow
    await workflowPage.deleteWorkflow(workflow.id);

    // Verify workflow is gone
    await expect(page.locator(`[data-testid="workflow-item-${workflow.id}"]`))
      .not.toBeVisible();
  });
});

test.describe('Workflow Execution', () => {
  test('should execute a simple workflow', async ({ page, apiHelper }) => {
    // Create a workflow with a simple transformation
    const workflow = await apiHelper.createWorkflow(workflowTemplates.dataTransform);

    await page.goto(`/workflow/${workflow.id}`);

    // Execute the workflow
    await page.click('[data-testid="execute-workflow-button"]');

    // Wait for execution to complete
    await expect(page.locator('[data-testid="execution-status-success"]'))
      .toBeVisible({ timeout: 30000 });

    // Verify output data
    await expect(page.locator('[data-testid="execution-output"]'))
      .toContainText('Hello, World!');

    // Cleanup
    await apiHelper.deleteWorkflow(workflow.id);
  });

  test('should show execution history', async ({ page, apiHelper }) => {
    const workflow = await apiHelper.createWorkflow(workflowTemplates.dataTransform);

    // Execute workflow multiple times
    await apiHelper.executeWorkflow(workflow.id);
    await apiHelper.executeWorkflow(workflow.id);

    await page.goto(`/workflow/${workflow.id}`);

    // Open execution history
    await page.click('[data-testid="execution-history-button"]');

    // Verify multiple executions are shown
    await expect(page.locator('[data-testid="execution-item"]'))
      .toHaveCount(2);

    await apiHelper.deleteWorkflow(workflow.id);
  });
});

test.describe('Workflow Activation', () => {
  test('should activate workflow with trigger', async ({ page, apiHelper }) => {
    const workflow = await apiHelper.createWorkflow({
      name: generateWorkflowName(),
      nodes: [
        {
          id: 'webhook',
          type: 'webhookTrigger',
          name: 'Webhook',
          position: { x: 100, y: 200 },
          parameters: {},
        },
        {
          id: 'respond',
          type: 'respondToWebhook',
          name: 'Respond',
          position: { x: 300, y: 200 },
          parameters: { responseBody: '{"status": "ok"}' },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: 'respond', type: 'main', index: 0 }]],
        },
      },
    });

    await page.goto(`/workflow/${workflow.id}`);

    // Activate workflow
    await page.click('[data-testid="activate-workflow-toggle"]');

    // Verify workflow is active
    await expect(page.locator('[data-testid="workflow-status-active"]')).toBeVisible();

    // Deactivate
    await page.click('[data-testid="activate-workflow-toggle"]');
    await expect(page.locator('[data-testid="workflow-status-inactive"]')).toBeVisible();

    await apiHelper.deleteWorkflow(workflow.id);
  });
});

/**
 * API E2E Tests
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:5678';
const apiUrl = `${baseUrl}/api/v1`;

test.describe('Health API', () => {
  test('should return health status', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});

test.describe('Workflows API', () => {
  let testWorkflowId: string;

  test('should create a workflow', async ({ request }) => {
    const response = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'API Test Workflow',
        nodes: [],
        connections: {},
        settings: {},
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe('API Test Workflow');

    testWorkflowId = data.id;
  });

  test('should get workflow by id', async ({ request }) => {
    // First create a workflow
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Get Test Workflow',
        nodes: [],
        connections: {},
      },
    });
    const created = await createResponse.json();

    // Then get it
    const response = await request.get(`${apiUrl}/workflows/${created.id}`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.id).toBe(created.id);
    expect(data.name).toBe('Get Test Workflow');

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${created.id}`);
  });

  test('should list workflows', async ({ request }) => {
    const response = await request.get(`${apiUrl}/workflows`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('should update workflow', async ({ request }) => {
    // Create
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Update Test Workflow',
        nodes: [],
        connections: {},
      },
    });
    const created = await createResponse.json();

    // Update
    const updateResponse = await request.patch(`${apiUrl}/workflows/${created.id}`, {
      data: {
        name: 'Updated Workflow Name',
      },
    });

    expect(updateResponse.ok()).toBeTruthy();

    const data = await updateResponse.json();
    expect(data.name).toBe('Updated Workflow Name');

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${created.id}`);
  });

  test('should delete workflow', async ({ request }) => {
    // Create
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Delete Test Workflow',
        nodes: [],
        connections: {},
      },
    });
    const created = await createResponse.json();

    // Delete
    const deleteResponse = await request.delete(`${apiUrl}/workflows/${created.id}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deleted
    const getResponse = await request.get(`${apiUrl}/workflows/${created.id}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should execute workflow', async ({ request }) => {
    // Create a simple workflow
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Execute Test Workflow',
        nodes: [
          {
            id: 'start',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 100, y: 200 },
            parameters: {},
          },
        ],
        connections: {},
      },
    });
    const workflow = await createResponse.json();

    // Execute
    const executeResponse = await request.post(`${apiUrl}/workflows/${workflow.id}/execute`, {
      data: { data: { test: 'value' } },
    });

    expect(executeResponse.ok()).toBeTruthy();

    const execution = await executeResponse.json();
    expect(execution.executionId).toBeDefined();

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${workflow.id}`);
  });

  test('should activate and deactivate workflow', async ({ request }) => {
    // Create with trigger
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Activation Test Workflow',
        nodes: [
          {
            id: 'webhook',
            type: 'webhookTrigger',
            name: 'Webhook',
            position: { x: 100, y: 200 },
            parameters: {},
          },
        ],
        connections: {},
      },
    });
    const workflow = await createResponse.json();

    // Activate
    const activateResponse = await request.post(`${apiUrl}/workflows/${workflow.id}/activate`);
    expect(activateResponse.ok()).toBeTruthy();

    // Verify active
    const getResponse1 = await request.get(`${apiUrl}/workflows/${workflow.id}`);
    const activeWorkflow = await getResponse1.json();
    expect(activeWorkflow.active).toBe(true);

    // Deactivate
    const deactivateResponse = await request.post(`${apiUrl}/workflows/${workflow.id}/deactivate`);
    expect(deactivateResponse.ok()).toBeTruthy();

    // Verify inactive
    const getResponse2 = await request.get(`${apiUrl}/workflows/${workflow.id}`);
    const inactiveWorkflow = await getResponse2.json();
    expect(inactiveWorkflow.active).toBe(false);

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${workflow.id}`);
  });
});

test.describe('Credentials API', () => {
  test('should list credential types', async ({ request }) => {
    const response = await request.get(`${apiUrl}/credentials/types`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test('should create and delete credential', async ({ request }) => {
    // Create
    const createResponse = await request.post(`${apiUrl}/credentials`, {
      data: {
        name: 'Test API Credential',
        type: 'httpBasicAuth',
        data: {
          user: 'testuser',
          password: 'testpass',
        },
      },
    });

    expect(createResponse.ok()).toBeTruthy();

    const credential = await createResponse.json();
    expect(credential.id).toBeDefined();
    expect(credential.name).toBe('Test API Credential');

    // Delete
    const deleteResponse = await request.delete(`${apiUrl}/credentials/${credential.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
  });

  test('should list credentials', async ({ request }) => {
    const response = await request.get(`${apiUrl}/credentials`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });
});

test.describe('Executions API', () => {
  test('should list executions', async ({ request }) => {
    const response = await request.get(`${apiUrl}/executions`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('should get execution by id', async ({ request }) => {
    // First create and execute a workflow
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Execution Get Test',
        nodes: [
          {
            id: 'start',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 100, y: 200 },
            parameters: {},
          },
        ],
        connections: {},
      },
    });
    const workflow = await createResponse.json();

    // Execute
    const executeResponse = await request.post(`${apiUrl}/workflows/${workflow.id}/execute`);
    const execution = await executeResponse.json();

    // Wait a bit for execution to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get execution
    const getResponse = await request.get(`${apiUrl}/executions/${execution.executionId}`);
    expect(getResponse.ok()).toBeTruthy();

    const executionData = await getResponse.json();
    expect(executionData.id).toBe(execution.executionId);

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${workflow.id}`);
  });
});

test.describe('Import/Export API', () => {
  test('should export workflow', async ({ request }) => {
    // Create
    const createResponse = await request.post(`${apiUrl}/workflows`, {
      data: {
        name: 'Export Test Workflow',
        nodes: [],
        connections: {},
      },
    });
    const workflow = await createResponse.json();

    // Export
    const exportResponse = await request.get(`${apiUrl}/import-export/workflow/${workflow.id}`);
    expect(exportResponse.ok()).toBeTruthy();

    const exported = await exportResponse.json();
    expect(exported.name).toBe('Export Test Workflow');

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${workflow.id}`);
  });

  test('should import workflow', async ({ request }) => {
    const workflowData = {
      name: 'Import Test Workflow',
      nodes: [],
      connections: {},
      settings: {},
    };

    const response = await request.post(`${apiUrl}/import-export/workflow`, {
      data: workflowData,
    });

    expect(response.ok()).toBeTruthy();

    const imported = await response.json();
    expect(imported.id).toBeDefined();
    expect(imported.name).toBe('Import Test Workflow');

    // Cleanup
    await request.delete(`${apiUrl}/workflows/${imported.id}`);
  });
});

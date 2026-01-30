/**
 * Test Fixtures and Helpers
 */

import { test as base, expect, Page, APIRequestContext } from '@playwright/test';

// Custom test fixtures
interface AgentSmithFixtures {
  workflowPage: WorkflowPage;
  apiHelper: ApiHelper;
}

// Page Object for Workflow operations
class WorkflowPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/workflows');
    await this.page.waitForSelector('[data-testid="workflow-list"]');
  }

  async createWorkflow(name: string) {
    await this.page.click('[data-testid="create-workflow-button"]');
    await this.page.fill('[data-testid="workflow-name-input"]', name);
    await this.page.click('[data-testid="save-workflow-button"]');
    await this.page.waitForURL(/.*workflow\/.*/);
  }

  async openWorkflow(nameOrId: string) {
    await this.page.click(`[data-testid="workflow-item-${nameOrId}"]`);
    await this.page.waitForURL(/.*workflow\/.*/);
  }

  async addNode(nodeType: string) {
    await this.page.click('[data-testid="add-node-button"]');
    await this.page.fill('[data-testid="node-search-input"]', nodeType);
    await this.page.click(`[data-testid="node-option-${nodeType}"]`);
  }

  async connectNodes(sourceId: string, targetId: string) {
    const source = this.page.locator(`[data-testid="node-${sourceId}"] [data-testid="output-port"]`);
    const target = this.page.locator(`[data-testid="node-${targetId}"] [data-testid="input-port"]`);

    await source.dragTo(target);
  }

  async saveWorkflow() {
    await this.page.click('[data-testid="save-workflow-button"]');
    await expect(this.page.locator('[data-testid="save-success-toast"]')).toBeVisible();
  }

  async executeWorkflow() {
    await this.page.click('[data-testid="execute-workflow-button"]');
    await this.page.waitForSelector('[data-testid="execution-panel"]');
  }

  async waitForExecution(timeout = 30000) {
    await expect(this.page.locator('[data-testid="execution-status-success"]'))
      .toBeVisible({ timeout });
  }

  async deleteWorkflow(workflowId: string) {
    await this.page.click(`[data-testid="workflow-menu-${workflowId}"]`);
    await this.page.click('[data-testid="delete-workflow-option"]');
    await this.page.click('[data-testid="confirm-delete-button"]');
  }
}

// API Helper for backend operations
class ApiHelper {
  constructor(private request: APIRequestContext, private baseUrl: string) {}

  async createWorkflow(data: any) {
    const response = await this.request.post(`${this.baseUrl}/api/v1/workflows`, {
      data,
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async getWorkflow(id: string) {
    const response = await this.request.get(`${this.baseUrl}/api/v1/workflows/${id}`);
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async deleteWorkflow(id: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/v1/workflows/${id}`);
    return response.ok();
  }

  async executeWorkflow(id: string, data?: any) {
    const response = await this.request.post(`${this.baseUrl}/api/v1/workflows/${id}/execute`, {
      data: { data },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async getExecution(id: string) {
    const response = await this.request.get(`${this.baseUrl}/api/v1/executions/${id}`);
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async waitForExecution(id: string, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(id);

      if (execution.status === 'success' || execution.status === 'error') {
        return execution;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Execution ${id} did not complete within ${timeout}ms`);
  }

  async createCredential(data: any) {
    const response = await this.request.post(`${this.baseUrl}/api/v1/credentials`, {
      data,
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async deleteCredential(id: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/v1/credentials/${id}`);
    return response.ok();
  }

  async healthCheck() {
    const response = await this.request.get(`${this.baseUrl}/api/v1/health`);
    return response.ok();
  }
}

// Extended test with custom fixtures
export const test = base.extend<AgentSmithFixtures>({
  workflowPage: async ({ page }, use) => {
    await use(new WorkflowPage(page));
  },

  apiHelper: async ({ request }, use) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5678';
    await use(new ApiHelper(request, baseUrl));
  },
});

export { expect };

// Test data generators
export function generateWorkflowName(): string {
  return `Test Workflow ${Date.now()}`;
}

export function generateCredentialName(): string {
  return `Test Credential ${Date.now()}`;
}

// Simple workflow templates
export const workflowTemplates = {
  empty: {
    name: 'Empty Workflow',
    nodes: [],
    connections: {},
    settings: {},
  },

  simpleHttp: {
    name: 'Simple HTTP Workflow',
    nodes: [
      {
        id: 'start',
        type: 'manualTrigger',
        name: 'Start',
        position: { x: 100, y: 200 },
        parameters: {},
      },
      {
        id: 'http',
        type: 'httpRequest',
        name: 'HTTP Request',
        position: { x: 300, y: 200 },
        parameters: {
          url: 'https://httpbin.org/get',
          method: 'GET',
        },
      },
    ],
    connections: {
      start: {
        main: [[{ node: 'http', type: 'main', index: 0 }]],
      },
    },
    settings: {},
  },

  dataTransform: {
    name: 'Data Transform Workflow',
    nodes: [
      {
        id: 'start',
        type: 'manualTrigger',
        name: 'Start',
        position: { x: 100, y: 200 },
        parameters: {},
      },
      {
        id: 'set',
        type: 'set',
        name: 'Set Values',
        position: { x: 300, y: 200 },
        parameters: {
          values: {
            string: [{ name: 'message', value: 'Hello, World!' }],
          },
        },
      },
    ],
    connections: {
      start: {
        main: [[{ node: 'set', type: 'main', index: 0 }]],
      },
    },
    settings: {},
  },
};

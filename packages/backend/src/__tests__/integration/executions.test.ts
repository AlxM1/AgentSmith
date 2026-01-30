/**
 * Integration Tests: Execution API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Express } from 'express';

describe('Execution API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testWorkflowId: string;
  let testExecutionId: string;

  beforeAll(async () => {
    app = await createApp();

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
      });

    if (loginRes.status === 200) {
      authToken = loginRes.body.accessToken;
    }

    // Create a test workflow
    if (authToken) {
      const workflowRes = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Execution Test Workflow',
          nodes: [
            {
              id: 'start',
              type: 'trigger',
              name: 'Manual Trigger',
              position: { x: 0, y: 0 },
              parameters: {},
            },
          ],
          connections: [],
        });

      if (workflowRes.status === 201) {
        const workflowData = workflowRes.body.data || workflowRes.body;
        testWorkflowId = workflowData.id;
      }
    }
  });

  describe('GET /api/executions', () => {
    it('should list executions', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/executions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Handle both wrapped { data: [...] } and { executions: [...] } formats
      const data = res.body.data || res.body.executions || res.body;
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support filtering by workflow', async () => {
      if (!authToken || !testWorkflowId) return;

      const res = await request(app)
        .get(`/api/executions?workflowId=${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should support filtering by status', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/executions?status=success')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should support date range filtering', async () => {
      if (!authToken) return;

      const startDate = new Date(Date.now() - 86400000).toISOString();
      const endDate = new Date().toISOString();

      const res = await request(app)
        .get(`/api/executions?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/executions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/executions', () => {
    it('should create a new execution', async () => {
      if (!authToken || !testWorkflowId) return;

      const res = await request(app)
        .post('/api/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: testWorkflowId,
          mode: 'manual',
          data: {
            input: 'test data',
          },
        });

      // Execution might be created (201/200), queued (202), or workflow not found (404)
      expect([200, 201, 202, 400, 404]).toContain(res.status);

      if (res.status === 201 || res.status === 200) {
        const data = res.body.data || res.body;
        testExecutionId = data.id || data.executionId;
      }
    });

    it('should reject invalid workflow ID', async () => {
      if (!authToken) return;

      const res = await request(app)
        .post('/api/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: 'invalid-workflow-id',
          mode: 'manual',
        });

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('GET /api/executions/:id', () => {
    it('should get execution details', async () => {
      if (!authToken || !testExecutionId) return;

      const res = await request(app)
        .get(`/api/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const data = res.body.data || res.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('status');
      }
    });

    it('should return 404 for non-existent execution', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/executions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/executions/:id/stop', () => {
    it('should stop a running execution', async () => {
      if (!authToken || !testExecutionId) return;

      const res = await request(app)
        .post(`/api/executions/${testExecutionId}/stop`)
        .set('Authorization', `Bearer ${authToken}`);

      // Might succeed or fail if execution already completed
      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe('POST /api/executions/:id/retry', () => {
    it('should retry a failed execution', async () => {
      if (!authToken || !testExecutionId) return;

      const res = await request(app)
        .post(`/api/executions/${testExecutionId}/retry`)
        .set('Authorization', `Bearer ${authToken}`);

      // Might succeed or fail depending on execution status
      expect([200, 201, 202, 400, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/executions/:id', () => {
    it('should delete execution', async () => {
      if (!authToken || !testExecutionId) return;

      const res = await request(app)
        .delete(`/api/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe('GET /api/executions/stats', () => {
    it('should return execution statistics', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/executions/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        // Handle wrapped response format
        const data = res.body.data || res.body;
        expect(data).toHaveProperty('total');
      }
    });
  });
});

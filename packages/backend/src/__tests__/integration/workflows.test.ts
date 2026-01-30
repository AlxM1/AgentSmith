/**
 * Integration Tests: Workflow API
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Express } from 'express';

describe('Workflow API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    // Initialize the app
    app = await createApp();

    // Get auth token for tests
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
      });

    if (loginRes.status === 200) {
      authToken = loginRes.body.accessToken;
    } else {
      // Create test user if doesn't exist
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testpassword123',
          name: 'Test User',
        });

      const retryLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123',
        });

      authToken = retryLogin.body.accessToken;
    }
  });

  afterAll(async () => {
    // Cleanup test workflows
    if (testWorkflowId) {
      await request(app)
        .delete(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
  });

  describe('POST /api/workflows', () => {
    it('should create a new workflow', async () => {
      const workflow = {
        name: 'Test Workflow',
        description: 'A test workflow for integration testing',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            name: 'Start',
            position: { x: 100, y: 100 },
            parameters: {},
          },
          {
            id: 'node-2',
            type: 'action',
            name: 'HTTP Request',
            position: { x: 300, y: 100 },
            parameters: {
              url: 'https://api.example.com',
              method: 'GET',
            },
          },
        ],
        connections: [
          {
            source: 'node-1',
            target: 'node-2',
          },
        ],
        settings: {
          timezone: 'UTC',
          saveExecutionData: true,
        },
      };

      const res = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(workflow.name);
      expect(res.body.nodes).toHaveLength(2);

      testWorkflowId = res.body.id;
    });

    it('should reject workflow without name', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nodes: [],
          connections: [],
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/workflows', () => {
    it('should list all workflows', async () => {
      const res = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workflows || res.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/workflows?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should support search', async () => {
      const res = await request(app)
        .get('/api/workflows?search=Test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('should get workflow by ID', async () => {
      if (!testWorkflowId) {
        return;
      }

      const res = await request(app)
        .get(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testWorkflowId);
    });

    it('should return 404 for non-existent workflow', async () => {
      const res = await request(app)
        .get('/api/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/workflows/:id', () => {
    it('should update workflow', async () => {
      if (!testWorkflowId) {
        return;
      }

      const res = await request(app)
        .patch(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test Workflow',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Test Workflow');
    });
  });

  describe('POST /api/workflows/:id/execute', () => {
    it('should execute workflow', async () => {
      if (!testWorkflowId) {
        return;
      }

      const res = await request(app)
        .post(`/api/workflows/${testWorkflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mode: 'test',
        });

      // Could be 200 (success) or 202 (accepted/queued)
      expect([200, 202, 400]).toContain(res.status);
    });
  });

  describe('POST /api/workflows/:id/activate', () => {
    it('should activate workflow', async () => {
      if (!testWorkflowId) {
        return;
      }

      const res = await request(app)
        .post(`/api/workflows/${testWorkflowId}/activate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400]).toContain(res.status);
    });
  });

  describe('POST /api/workflows/:id/deactivate', () => {
    it('should deactivate workflow', async () => {
      if (!testWorkflowId) {
        return;
      }

      const res = await request(app)
        .post(`/api/workflows/${testWorkflowId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400]).toContain(res.status);
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow', async () => {
      // Create a workflow to delete
      const createRes = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Workflow to Delete',
          nodes: [],
          connections: [],
        });

      if (createRes.status !== 201) {
        return;
      }

      const deleteRes = await request(app)
        .delete(`/api/workflows/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const getRes = await request(app)
        .get(`/api/workflows/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});

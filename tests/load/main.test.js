/**
 * k6 Load Test - Main Test Suite
 * Tests core AgentSmith functionality under load
 *
 * Run with: k6 run tests/load/main.test.js
 * Run with options: k6 run --env BASE_URL=https://api.example.com tests/load/main.test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { config, stages } from './k6-config.js';

// Custom metrics
const workflowsCreated = new Counter('workflows_created');
const executionsTriggered = new Counter('executions_triggered');
const authFailures = new Rate('auth_failures');
const apiErrors = new Rate('api_errors');
const workflowExecutionTime = new Trend('workflow_execution_time');

// Test options
export const options = {
  stages: stages.load, // Change to: smoke, stress, spike, or soak

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>50'],
    'api_errors': ['rate<0.05'],
    'auth_failures': ['rate<0.01'],
  },

  // Tags for segmentation
  tags: {
    testType: 'load',
    environment: __ENV.ENVIRONMENT || 'staging',
  },
};

// Setup - runs once before all iterations
export function setup() {
  // Login and get auth token
  const loginRes = http.post(
    `${config.baseUrl}/api/auth/login`,
    JSON.stringify({
      email: config.testUser.email,
      password: config.testUser.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('accessToken') !== undefined,
  });

  if (loginRes.status !== 200) {
    console.error('Setup failed: Unable to authenticate');
    return { error: true };
  }

  const accessToken = loginRes.json('accessToken');

  // Create a test workflow for execution tests
  const workflowRes = http.post(
    `${config.baseUrl}/api/workflows`,
    JSON.stringify({
      name: `Load Test Workflow ${Date.now()}`,
      nodes: [
        {
          id: 'start',
          type: 'trigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'delay',
          type: 'delay',
          name: 'Wait',
          position: { x: 200, y: 0 },
          parameters: { delay: 100 },
        },
      ],
      connections: [{ source: 'start', target: 'delay' }],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const testWorkflowId = workflowRes.status === 201 ? workflowRes.json('id') : null;

  return {
    accessToken,
    testWorkflowId,
  };
}

// Main test function - runs for each VU iteration
export default function (data) {
  if (data.error) {
    console.error('Skipping test due to setup failure');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.accessToken}`,
  };

  // ============================================
  // Test Group: Health Checks
  // ============================================
  group('Health Checks', () => {
    const healthRes = http.get(`${config.baseUrl}/health`);
    check(healthRes, {
      'health check status 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });

    const readyRes = http.get(`${config.baseUrl}/health/ready`);
    check(readyRes, {
      'ready check status 200': (r) => r.status === 200,
    });
  });

  sleep(randomIntBetween(1, 3));

  // ============================================
  // Test Group: Authentication
  // ============================================
  group('Authentication', () => {
    // Get current user
    const meRes = http.get(`${config.baseUrl}/api/auth/me`, { headers });
    const authSuccess = check(meRes, {
      'get user status 200': (r) => r.status === 200,
      'user has email': (r) => r.json('email') !== undefined,
    });

    if (!authSuccess) {
      authFailures.add(1);
    }
  });

  sleep(randomIntBetween(1, 2));

  // ============================================
  // Test Group: Workflows API
  // ============================================
  group('Workflows API', () => {
    // List workflows
    const listRes = http.get(`${config.baseUrl}/api/workflows?page=1&limit=10`, { headers });
    check(listRes, {
      'list workflows status 200': (r) => r.status === 200,
      'list workflows response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Create workflow
    const createRes = http.post(
      `${config.baseUrl}/api/workflows`,
      JSON.stringify({
        name: `Test Workflow ${randomString(8)}`,
        description: 'Load test workflow',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [],
      }),
      { headers }
    );

    const createSuccess = check(createRes, {
      'create workflow status 201': (r) => r.status === 201,
      'create workflow has id': (r) => r.json('id') !== undefined,
    });

    if (createSuccess) {
      workflowsCreated.add(1);
      const workflowId = createRes.json('id');

      // Get workflow
      const getRes = http.get(`${config.baseUrl}/api/workflows/${workflowId}`, { headers });
      check(getRes, {
        'get workflow status 200': (r) => r.status === 200,
      });

      // Update workflow
      const updateRes = http.patch(
        `${config.baseUrl}/api/workflows/${workflowId}`,
        JSON.stringify({
          description: 'Updated by load test',
        }),
        { headers }
      );
      check(updateRes, {
        'update workflow status 200': (r) => r.status === 200,
      });

      // Delete workflow
      const deleteRes = http.del(`${config.baseUrl}/api/workflows/${workflowId}`, null, { headers });
      check(deleteRes, {
        'delete workflow status 200': (r) => r.status === 200,
      });
    } else {
      apiErrors.add(1);
    }
  });

  sleep(randomIntBetween(1, 3));

  // ============================================
  // Test Group: Executions API
  // ============================================
  group('Executions API', () => {
    // List executions
    const listRes = http.get(`${config.baseUrl}/api/executions?page=1&limit=10`, { headers });
    check(listRes, {
      'list executions status 200': (r) => r.status === 200,
    });

    // Trigger execution if we have a test workflow
    if (data.testWorkflowId) {
      const startTime = Date.now();

      const execRes = http.post(
        `${config.baseUrl}/api/workflows/${data.testWorkflowId}/execute`,
        JSON.stringify({ mode: 'test' }),
        { headers }
      );

      const execSuccess = check(execRes, {
        'execute workflow status 2xx': (r) => r.status >= 200 && r.status < 300,
      });

      if (execSuccess) {
        executionsTriggered.add(1);
        workflowExecutionTime.add(Date.now() - startTime);
      } else {
        apiErrors.add(1);
      }
    }
  });

  sleep(randomIntBetween(1, 2));

  // ============================================
  // Test Group: Credentials API
  // ============================================
  group('Credentials API', () => {
    const listRes = http.get(`${config.baseUrl}/api/credentials`, { headers });
    check(listRes, {
      'list credentials status 200': (r) => r.status === 200,
    });
  });

  sleep(randomIntBetween(2, 5));
}

// Teardown - runs once after all iterations
export function teardown(data) {
  if (data.error) return;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.accessToken}`,
  };

  // Clean up test workflow
  if (data.testWorkflowId) {
    http.del(`${config.baseUrl}/api/workflows/${data.testWorkflowId}`, null, { headers });
  }

  console.log('Load test teardown completed');
}

// Handle summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data, null, 2),
    'tests/load/results/summary.html': htmlReport(data),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { metrics, root_group } = data;

  let summary = '\n========== LOAD TEST SUMMARY ==========\n\n';

  // Request metrics
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `  Rate: ${metrics.http_reqs?.values?.rate?.toFixed(2) || 0}/s\n`;
  summary += `  Failed: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  // Duration metrics
  summary += 'Response Times:\n';
  summary += `  Avg: ${metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `  p50: ${metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms\n`;
  summary += `  p95: ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `  p99: ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms\n\n`;

  // Custom metrics
  summary += 'Custom Metrics:\n';
  summary += `  Workflows Created: ${metrics.workflows_created?.values?.count || 0}\n`;
  summary += `  Executions Triggered: ${metrics.executions_triggered?.values?.count || 0}\n`;
  summary += `  API Error Rate: ${((metrics.api_errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `  Auth Failure Rate: ${((metrics.auth_failures?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  // Threshold results
  summary += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.thresholds || {})) {
    const status = threshold.ok ? '✓' : '✗';
    summary += `  ${status} ${name}\n`;
  }

  summary += '\n========================================\n';

  return summary;
}

// HTML report helper
function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>k6 Load Test Report - AgentSmith</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
    .pass { color: green; }
    .fail { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>AgentSmith Load Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <h2>Summary</h2>
  <div class="metric">
    <strong>Total Requests:</strong> ${data.metrics.http_reqs?.values?.count || 0}
  </div>
  <div class="metric">
    <strong>Request Rate:</strong> ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0}/s
  </div>
  <div class="metric">
    <strong>Failure Rate:</strong> ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
  </div>

  <h2>Response Times</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Average</td><td>${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms</td></tr>
    <tr><td>p50</td><td>${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 0}ms</td></tr>
    <tr><td>p95</td><td>${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms</td></tr>
    <tr><td>p99</td><td>${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms</td></tr>
  </table>

  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    ${Object.entries(data.thresholds || {}).map(([name, t]) =>
      `<tr><td>${name}</td><td class="${t.ok ? 'pass' : 'fail'}">${t.ok ? 'PASS' : 'FAIL'}</td></tr>`
    ).join('')}
  </table>
</body>
</html>
  `;
}

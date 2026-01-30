/**
 * k6 Load Testing Configuration
 * AgentSmith Production Load Tests
 */

// Test configuration
export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:4000',
  apiVersion: 'v1',

  // Test credentials
  testUser: {
    email: __ENV.TEST_USER_EMAIL || 'loadtest@example.com',
    password: __ENV.TEST_USER_PASSWORD || 'LoadTest123!',
  },

  // Thresholds
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>100'],
  },
};

// Test stages for different scenarios
export const stages = {
  // Smoke test - verify system works
  smoke: [
    { duration: '1m', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '1m', target: 0 },
  ],

  // Load test - normal expected load
  load: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],

  // Stress test - beyond normal capacity
  stress: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 0 },
  ],

  // Spike test - sudden traffic surge
  spike: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 0 },
  ],

  // Soak test - extended duration
  soak: [
    { duration: '5m', target: 100 },
    { duration: '4h', target: 100 },
    { duration: '5m', target: 0 },
  ],
};

export default config;

/**
 * Authentication Setup
 * Runs before tests to authenticate and save state
 */

import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Check if we need to create a test user
  const testEmail = process.env.TEST_USER_EMAIL || 'test@agentsmith.local';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

  // Try to login
  await page.goto('/login');

  // Check if we're already logged in
  if (await page.url().includes('/workflows')) {
    await page.context().storageState({ path: authFile });
    return;
  }

  // Fill login form
  await page.fill('[data-testid="email-input"]', testEmail);
  await page.fill('[data-testid="password-input"]', testPassword);
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await page.waitForURL('**/workflows**', { timeout: 10000 }).catch(async () => {
    // If login fails, try to create the user first
    console.log('Login failed, attempting to create test user...');

    // Navigate to signup if available
    await page.goto('/signup');

    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.fill('[data-testid="confirm-password-input"]', testPassword);
    await page.fill('[data-testid="first-name-input"]', 'Test');
    await page.fill('[data-testid="last-name-input"]', 'User');
    await page.click('[data-testid="signup-button"]');

    await page.waitForURL('**/workflows**', { timeout: 10000 });
  });

  // Verify we're on the workflows page
  await expect(page).toHaveURL(/.*workflows.*/);

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

setup('authenticate admin', async ({ page }) => {
  const adminAuthFile = 'playwright/.auth/admin.json';
  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@agentsmith.local';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'adminpassword123';

  await page.goto('/login');

  await page.fill('[data-testid="email-input"]', adminEmail);
  await page.fill('[data-testid="password-input"]', adminPassword);
  await page.click('[data-testid="login-button"]');

  await page.waitForURL('**/workflows**', { timeout: 10000 });

  await page.context().storageState({ path: adminAuthFile });
});

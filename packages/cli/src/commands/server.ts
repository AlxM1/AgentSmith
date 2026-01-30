/**
 * Server Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { api } from '../api.js';
import { getApiUrl, config } from '../config.js';

export const serverCommands = {
  async health() {
    const spinner = ora('Checking server health...').start();

    try {
      const health = await api.getHealth();
      spinner.stop();

      const statusColor = health.status === 'ok' ? chalk.green : chalk.red;

      console.log(chalk.cyan('\nServer Health'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('Status:'), statusColor(health.status));
      console.log(chalk.white('Version:'), health.version || 'Unknown');
      console.log(chalk.white('Uptime:'), formatUptime(health.uptime));

      if (health.database) {
        console.log(chalk.white('Database:'), health.database.status === 'ok' ? chalk.green('Connected') : chalk.red('Disconnected'));
      }

      if (health.redis) {
        console.log(chalk.white('Redis:'), health.redis.status === 'ok' ? chalk.green('Connected') : chalk.red('Disconnected'));
      }

      if (health.queue) {
        console.log(chalk.white('Queue:'), `${health.queue.waiting || 0} waiting, ${health.queue.active || 0} active`);
      }
    } catch (error) {
      spinner.fail(chalk.red('Server is not reachable'));
      console.log(chalk.gray(`\nAPI URL: ${getApiUrl()}`));
      console.log(chalk.yellow('Make sure AgentSmith is running and the API URL is correct.'));
    }
  },

  async info() {
    const spinner = ora('Fetching server info...').start();

    try {
      const info = await api.getServerInfo();
      spinner.stop();

      console.log(chalk.cyan('\nServer Information'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('Version:'), info.version || 'Unknown');
      console.log(chalk.white('Node.js:'), info.nodeVersion || process.version);
      console.log(chalk.white('Platform:'), info.platform || process.platform);
      console.log(chalk.white('Environment:'), info.environment || 'unknown');

      if (info.features) {
        console.log(chalk.cyan('\nEnabled Features:'));
        for (const [feature, enabled] of Object.entries(info.features)) {
          const status = enabled ? chalk.green('Yes') : chalk.gray('No');
          console.log(`  ${feature}: ${status}`);
        }
      }

      if (info.license) {
        console.log(chalk.cyan('\nLicense:'));
        console.log(chalk.white('  Type:'), info.license.type);
        console.log(chalk.white('  Expires:'), info.license.expiresAt || 'Never');
      }
    } catch (error) {
      spinner.fail('Failed to fetch server info');
    }
  },

  async metrics() {
    const spinner = ora('Fetching metrics...').start();

    try {
      const metrics = await api.getMetrics();
      spinner.stop();

      console.log(chalk.cyan('\nServer Metrics'));
      console.log(chalk.gray('─'.repeat(50)));

      // Workflow metrics
      if (metrics.workflows) {
        console.log(chalk.yellow('\nWorkflows:'));
        console.log(`  Total: ${metrics.workflows.total || 0}`);
        console.log(`  Active: ${metrics.workflows.active || 0}`);
      }

      // Execution metrics
      if (metrics.executions) {
        console.log(chalk.yellow('\nExecutions (last 24h):'));
        console.log(`  Total: ${metrics.executions.total || 0}`);
        console.log(`  Success: ${chalk.green(metrics.executions.success || 0)}`);
        console.log(`  Failed: ${chalk.red(metrics.executions.failed || 0)}`);
        console.log(`  Running: ${chalk.blue(metrics.executions.running || 0)}`);
      }

      // Performance metrics
      if (metrics.performance) {
        console.log(chalk.yellow('\nPerformance:'));
        console.log(`  Avg Execution Time: ${metrics.performance.avgExecutionTime || 0}ms`);
        console.log(`  P95 Execution Time: ${metrics.performance.p95ExecutionTime || 0}ms`);
        console.log(`  Success Rate: ${((metrics.performance.successRate || 0) * 100).toFixed(1)}%`);
      }

      // System metrics
      if (metrics.system) {
        console.log(chalk.yellow('\nSystem:'));
        console.log(`  CPU Usage: ${(metrics.system.cpuUsage * 100).toFixed(1)}%`);
        console.log(`  Memory Usage: ${formatBytes(metrics.system.memoryUsage)} / ${formatBytes(metrics.system.memoryTotal)}`);
        console.log(`  Uptime: ${formatUptime(metrics.system.uptime)}`);
      }

      // Queue metrics
      if (metrics.queue) {
        console.log(chalk.yellow('\nQueue:'));
        console.log(`  Waiting: ${metrics.queue.waiting || 0}`);
        console.log(`  Active: ${metrics.queue.active || 0}`);
        console.log(`  Completed: ${metrics.queue.completed || 0}`);
        console.log(`  Failed: ${metrics.queue.failed || 0}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch metrics');
    }
  },
};

export async function showStatus() {
  const apiUrl = getApiUrl();

  console.log(chalk.cyan('\nAgentSmith CLI Status'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white('API URL:'), apiUrl);
  console.log(chalk.white('API Key:'), config.get('apiKey') ? chalk.green('Configured') : chalk.yellow('Not set'));
  console.log(chalk.white('Config File:'), config.path);

  // Test connection
  const spinner = ora('Testing connection...').start();

  try {
    const health = await api.getHealth();
    spinner.succeed(chalk.green('Connected to AgentSmith'));

    console.log(chalk.white('\nServer Status:'), health.status === 'ok' ? chalk.green('Healthy') : chalk.red('Unhealthy'));
    console.log(chalk.white('Server Version:'), health.version || 'Unknown');
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      spinner.fail(chalk.red('Cannot connect to server'));
      console.log(chalk.yellow('\nMake sure AgentSmith is running at the configured URL.'));
    } else if (error.response?.status === 401) {
      spinner.fail(chalk.red('Authentication failed'));
      console.log(chalk.yellow('\nCheck your API key configuration.'));
    } else {
      spinner.fail(chalk.red('Connection error'));
      console.log(chalk.gray(error.message));
    }
  }
}

// Helper functions
function formatUptime(seconds?: number): string {
  if (!seconds) return 'Unknown';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Execution Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { WebSocket } from 'ws';
import { api } from '../api.js';
import { getApiUrl } from '../config.js';

export const executionCommands = {
  async list(options: { workflow?: string; status?: string; limit?: string; json?: boolean }) {
    const spinner = ora('Fetching executions...').start();

    try {
      const executions = await api.listExecutions({
        workflowId: options.workflow,
        status: options.status,
        limit: parseInt(options.limit || '20', 10),
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(executions, null, 2));
        return;
      }

      if (executions.length === 0) {
        console.log(chalk.yellow('No executions found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Workflow'),
          chalk.cyan('Status'),
          chalk.cyan('Mode'),
          chalk.cyan('Started'),
          chalk.cyan('Duration'),
        ],
        colWidths: [38, 25, 12, 10, 20, 12],
      });

      for (const exec of executions) {
        const statusColor = {
          success: chalk.green,
          error: chalk.red,
          running: chalk.yellow,
          waiting: chalk.blue,
        }[exec.status] || chalk.gray;

        const duration = exec.stoppedAt
          ? `${((new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(1)}s`
          : '-';

        table.push([
          exec.id,
          (exec.workflowName || 'Unknown').substring(0, 23),
          statusColor(exec.status),
          exec.mode || 'manual',
          new Date(exec.startedAt).toLocaleString(),
          duration,
        ]);
      }

      console.log(table.toString());
      console.log(chalk.gray(`\nShowing ${executions.length} executions`));
    } catch (error) {
      spinner.fail('Failed to fetch executions');
    }
  },

  async get(id: string, options: { json?: boolean }) {
    const spinner = ora('Fetching execution...').start();

    try {
      const execution = await api.getExecution(id);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(execution, null, 2));
        return;
      }

      const statusColor = {
        success: chalk.green,
        error: chalk.red,
        running: chalk.yellow,
        waiting: chalk.blue,
      }[execution.status] || chalk.gray;

      console.log(chalk.cyan('\nExecution Details'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('ID:'), execution.id);
      console.log(chalk.white('Workflow:'), execution.workflowName || execution.workflowId);
      console.log(chalk.white('Status:'), statusColor(execution.status));
      console.log(chalk.white('Mode:'), execution.mode || 'manual');
      console.log(chalk.white('Started:'), new Date(execution.startedAt).toLocaleString());

      if (execution.stoppedAt) {
        console.log(chalk.white('Finished:'), new Date(execution.stoppedAt).toLocaleString());
        const duration = (new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000;
        console.log(chalk.white('Duration:'), `${duration.toFixed(2)}s`);
      }

      if (execution.status === 'error' && execution.data?.error) {
        console.log(chalk.red('\nError:'));
        console.log(chalk.red(execution.data.error.message || execution.data.error));
      }

      if (execution.data?.resultData) {
        console.log(chalk.cyan('\nOutput Data:'));
        console.log(JSON.stringify(execution.data.resultData, null, 2));
      }
    } catch (error) {
      spinner.fail('Failed to fetch execution');
    }
  },

  async stop(id: string) {
    const spinner = ora('Stopping execution...').start();
    try {
      await api.stopExecution(id);
      spinner.succeed(chalk.green('Execution stopped'));
    } catch (error) {
      spinner.fail('Failed to stop execution');
    }
  },

  async retry(id: string) {
    const spinner = ora('Retrying execution...').start();
    try {
      const result = await api.retryExecution(id);
      spinner.succeed(chalk.green(`Execution retried. New execution ID: ${result.executionId}`));
    } catch (error) {
      spinner.fail('Failed to retry execution');
    }
  },

  async delete(id: string, options: { force?: boolean }) {
    try {
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete execution ${id}?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      const spinner = ora('Deleting execution...').start();
      await api.deleteExecution(id);
      spinner.succeed(chalk.green('Execution deleted'));
    } catch (error: any) {
      console.error(chalk.red('Failed to delete execution:'), error.message);
    }
  },

  async logs(id: string, options: { follow?: boolean }) {
    try {
      const execution = await api.getExecution(id);

      console.log(chalk.cyan(`\nLogs for execution ${id}`));
      console.log(chalk.gray('─'.repeat(50)));

      // Display existing logs
      if (execution.data?.executionData) {
        for (const [nodeName, nodeData] of Object.entries(execution.data.executionData as any)) {
          console.log(chalk.yellow(`\n[${nodeName}]`));
          if ((nodeData as any).data) {
            console.log(JSON.stringify((nodeData as any).data, null, 2));
          }
          if ((nodeData as any).error) {
            console.log(chalk.red('Error:'), (nodeData as any).error.message);
          }
        }
      }

      // Follow mode
      if (options.follow && execution.status === 'running') {
        console.log(chalk.gray('\nFollowing execution logs... (Ctrl+C to stop)'));

        const wsUrl = getApiUrl().replace('http', 'ws').replace('/api/v1', '/ws');
        const ws = new WebSocket(`${wsUrl}/execution/${id}/logs`);

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            const timestamp = new Date().toLocaleTimeString();

            if (event.type === 'nodeOutput') {
              console.log(chalk.yellow(`[${timestamp}] ${event.nodeName}:`));
              console.log(JSON.stringify(event.data, null, 2));
            } else if (event.type === 'nodeError') {
              console.log(chalk.red(`[${timestamp}] ${event.nodeName} Error:`));
              console.log(chalk.red(event.error));
            } else if (event.type === 'executionFinished') {
              console.log(chalk.cyan(`\n[${timestamp}] Execution finished: ${event.status}`));
              ws.close();
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        ws.on('close', () => {
          process.exit(0);
        });

        process.on('SIGINT', () => {
          ws.close();
          process.exit(0);
        });

        await new Promise(() => {});
      }
    } catch (error: any) {
      console.error(chalk.red('Failed to get logs:'), error.message);
    }
  },
};

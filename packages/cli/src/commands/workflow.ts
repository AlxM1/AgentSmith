/**
 * Workflow Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { readFile } from 'fs/promises';
import { WebSocket } from 'ws';
import { api } from '../api.js';
import { getApiUrl } from '../config.js';

export const workflowCommands = {
  async list(options: { all?: boolean; tag?: string; folder?: string; json?: boolean }) {
    const spinner = ora('Fetching workflows...').start();

    try {
      const workflows = await api.listWorkflows({
        active: options.all ? undefined : true,
        tags: options.tag,
        folderId: options.folder,
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(workflows, null, 2));
        return;
      }

      if (workflows.length === 0) {
        console.log(chalk.yellow('No workflows found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Name'),
          chalk.cyan('Active'),
          chalk.cyan('Tags'),
          chalk.cyan('Updated'),
        ],
        colWidths: [38, 30, 8, 20, 20],
      });

      for (const wf of workflows) {
        table.push([
          wf.id,
          wf.name.substring(0, 28),
          wf.active ? chalk.green('Yes') : chalk.gray('No'),
          (wf.tags || []).join(', ').substring(0, 18),
          new Date(wf.updatedAt).toLocaleDateString(),
        ]);
      }

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${workflows.length} workflows`));
    } catch (error) {
      spinner.fail('Failed to fetch workflows');
    }
  },

  async get(id: string, options: { json?: boolean }) {
    const spinner = ora('Fetching workflow...').start();

    try {
      const workflow = await api.getWorkflow(id);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(workflow, null, 2));
        return;
      }

      console.log(chalk.cyan('\nWorkflow Details'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('ID:'), workflow.id);
      console.log(chalk.white('Name:'), workflow.name);
      console.log(chalk.white('Active:'), workflow.active ? chalk.green('Yes') : chalk.red('No'));
      console.log(chalk.white('Tags:'), (workflow.tags || []).join(', ') || 'None');
      console.log(chalk.white('Nodes:'), workflow.nodes?.length || 0);
      console.log(chalk.white('Created:'), new Date(workflow.createdAt).toLocaleString());
      console.log(chalk.white('Updated:'), new Date(workflow.updatedAt).toLocaleString());

      if (workflow.nodes?.length > 0) {
        console.log(chalk.cyan('\nNodes:'));
        for (const node of workflow.nodes) {
          console.log(`  - ${node.name} (${node.type})`);
        }
      }
    } catch (error) {
      spinner.fail('Failed to fetch workflow');
    }
  },

  async create(options: { name?: string; file?: string }) {
    try {
      let workflowData: any;

      if (options.file) {
        const content = await readFile(options.file, 'utf-8');
        workflowData = JSON.parse(content);
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Workflow name:',
            default: options.name || 'New Workflow',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
          },
        ]);

        workflowData = {
          name: answers.name,
          description: answers.description,
          nodes: [],
          connections: {},
          settings: {},
        };
      }

      const spinner = ora('Creating workflow...').start();
      const workflow = await api.createWorkflow(workflowData);
      spinner.succeed(chalk.green(`Workflow created: ${workflow.id}`));

      console.log(chalk.gray(`\nOpen in UI: ${getApiUrl().replace('/api/v1', '')}/workflow/${workflow.id}`));
    } catch (error: any) {
      console.error(chalk.red('Failed to create workflow:'), error.message);
    }
  },

  async update(id: string, options: { name?: string; file?: string }) {
    try {
      let updates: any = {};

      if (options.file) {
        const content = await readFile(options.file, 'utf-8');
        updates = JSON.parse(content);
      } else if (options.name) {
        updates.name = options.name;
      } else {
        const current = await api.getWorkflow(id);
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'New name:',
            default: current.name,
          },
        ]);
        updates.name = answers.name;
      }

      const spinner = ora('Updating workflow...').start();
      await api.updateWorkflow(id, updates);
      spinner.succeed(chalk.green('Workflow updated'));
    } catch (error: any) {
      console.error(chalk.red('Failed to update workflow:'), error.message);
    }
  },

  async delete(id: string, options: { force?: boolean }) {
    try {
      if (!options.force) {
        const workflow = await api.getWorkflow(id);
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete workflow "${workflow.name}"?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      const spinner = ora('Deleting workflow...').start();
      await api.deleteWorkflow(id);
      spinner.succeed(chalk.green('Workflow deleted'));
    } catch (error: any) {
      console.error(chalk.red('Failed to delete workflow:'), error.message);
    }
  },

  async activate(id: string) {
    const spinner = ora('Activating workflow...').start();
    try {
      await api.activateWorkflow(id);
      spinner.succeed(chalk.green('Workflow activated'));
    } catch (error) {
      spinner.fail('Failed to activate workflow');
    }
  },

  async deactivate(id: string) {
    const spinner = ora('Deactivating workflow...').start();
    try {
      await api.deactivateWorkflow(id);
      spinner.succeed(chalk.green('Workflow deactivated'));
    } catch (error) {
      spinner.fail('Failed to deactivate workflow');
    }
  },

  async execute(id: string, options: { data?: string; file?: string; wait?: boolean; timeout?: string }) {
    try {
      let inputData: any;

      if (options.file) {
        const content = await readFile(options.file, 'utf-8');
        inputData = JSON.parse(content);
      } else if (options.data) {
        inputData = JSON.parse(options.data);
      }

      const spinner = ora('Executing workflow...').start();
      const result = await api.executeWorkflow(id, inputData);

      if (options.wait) {
        spinner.text = 'Waiting for execution to complete...';

        // Poll for completion
        const timeout = parseInt(options.timeout || '60000', 10);
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          const execution = await api.getExecution(result.executionId);

          if (execution.status === 'success') {
            spinner.succeed(chalk.green('Execution completed successfully'));
            console.log(chalk.cyan('\nOutput:'));
            console.log(JSON.stringify(execution.data?.resultData || {}, null, 2));
            return;
          } else if (execution.status === 'error') {
            spinner.fail(chalk.red('Execution failed'));
            console.log(chalk.red('\nError:'), execution.data?.error || 'Unknown error');
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        spinner.warn(chalk.yellow('Execution timeout'));
      } else {
        spinner.succeed(chalk.green(`Execution started: ${result.executionId}`));
      }
    } catch (error: any) {
      console.error(chalk.red('Failed to execute workflow:'), error.message);
    }
  },

  async watch(id: string) {
    console.log(chalk.cyan(`Watching executions for workflow ${id}...`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    try {
      const wsUrl = getApiUrl().replace('http', 'ws').replace('/api/v1', '/ws');
      const ws = new WebSocket(`${wsUrl}/executions?workflowId=${id}`);

      ws.on('open', () => {
        console.log(chalk.green('Connected to execution stream'));
      });

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          const timestamp = new Date().toLocaleTimeString();

          switch (event.type) {
            case 'executionStarted':
              console.log(chalk.yellow(`[${timestamp}] Execution started: ${event.executionId}`));
              break;
            case 'executionProgress':
              console.log(chalk.blue(`[${timestamp}] Node: ${event.nodeName} - ${event.status}`));
              break;
            case 'executionFinished':
              const status = event.status === 'success' ? chalk.green('SUCCESS') : chalk.red('FAILED');
              console.log(`[${timestamp}] Execution finished: ${event.executionId} - ${status}`);
              break;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error.message);
      });

      ws.on('close', () => {
        console.log(chalk.gray('\nDisconnected from execution stream'));
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        ws.close();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error: any) {
      console.error(chalk.red('Failed to connect:'), error.message);
    }
  },
};

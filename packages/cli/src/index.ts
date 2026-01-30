#!/usr/bin/env node

/**
 * AgentSmith CLI - Command Line Interface
 * Manage workflows, credentials, and executions from the terminal
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from './config.js';
import { workflowCommands } from './commands/workflow.js';
import { credentialCommands } from './commands/credential.js';
import { executionCommands } from './commands/execution.js';
import { configCommands } from './commands/config.js';
import { serverCommands } from './commands/server.js';
import { importExportCommands } from './commands/import-export.js';

const program = new Command();

// ASCII Art Banner
const banner = chalk.cyan(`
   _                    _   ____            _ _   _
  / \\   __ _  ___ _ __ | |_/ ___| _ __ ___ (_) |_| |__
 / _ \\ / _\` |/ _ \\ '_ \\| __\\___ \\| '_ \` _ \\| | __| '_ \\
/ ___ \\ (_| |  __/ | | | |_ ___) | | | | | | | |_| | | |
/_/   \\_\\__, |\\___|_| |_|\\__|____/|_| |_| |_|_|\\__|_| |_|
       |___/
`);

program
  .name('agentsmith')
  .description('AgentSmith CLI - Workflow Automation Platform')
  .version('1.0.0')
  .hook('preAction', () => {
    // Check if configured
    if (!config.get('apiUrl') && !['config', 'init'].some(cmd => process.argv.includes(cmd))) {
      console.log(chalk.yellow('\nNo API URL configured. Run `agentsmith init` to set up the CLI.\n'));
    }
  });

// Show banner on help
program.addHelpText('before', banner);

// Init command
program
  .command('init')
  .description('Initialize CLI configuration')
  .option('-u, --url <url>', 'API URL')
  .option('-k, --api-key <key>', 'API Key')
  .action(async (options) => {
    const { initConfig } = await import('./commands/config.js');
    await initConfig(options);
  });

// Status command
program
  .command('status')
  .description('Show connection status and server info')
  .action(async () => {
    const { showStatus } = await import('./commands/server.js');
    await showStatus();
  });

// Workflow commands
const workflow = program
  .command('workflow')
  .alias('wf')
  .description('Manage workflows');

workflow
  .command('list')
  .alias('ls')
  .description('List all workflows')
  .option('-a, --all', 'Include inactive workflows')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('-f, --folder <folder>', 'Filter by folder')
  .option('--json', 'Output as JSON')
  .action(workflowCommands.list);

workflow
  .command('get <id>')
  .description('Get workflow details')
  .option('--json', 'Output as JSON')
  .action(workflowCommands.get);

workflow
  .command('create')
  .description('Create a new workflow')
  .option('-n, --name <name>', 'Workflow name')
  .option('-f, --file <file>', 'Import from JSON file')
  .action(workflowCommands.create);

workflow
  .command('update <id>')
  .description('Update a workflow')
  .option('-n, --name <name>', 'New name')
  .option('-f, --file <file>', 'Update from JSON file')
  .action(workflowCommands.update);

workflow
  .command('delete <id>')
  .description('Delete a workflow')
  .option('-f, --force', 'Skip confirmation')
  .action(workflowCommands.delete);

workflow
  .command('activate <id>')
  .description('Activate a workflow')
  .action(workflowCommands.activate);

workflow
  .command('deactivate <id>')
  .description('Deactivate a workflow')
  .action(workflowCommands.deactivate);

workflow
  .command('execute <id>')
  .alias('run')
  .description('Execute a workflow')
  .option('-d, --data <json>', 'Input data as JSON')
  .option('-f, --file <file>', 'Input data from file')
  .option('-w, --wait', 'Wait for execution to complete')
  .option('--timeout <ms>', 'Execution timeout in milliseconds', '60000')
  .action(workflowCommands.execute);

workflow
  .command('watch <id>')
  .description('Watch workflow executions in real-time')
  .action(workflowCommands.watch);

// Credential commands
const credential = program
  .command('credential')
  .alias('cred')
  .description('Manage credentials');

credential
  .command('list')
  .alias('ls')
  .description('List all credentials')
  .option('-t, --type <type>', 'Filter by credential type')
  .option('--json', 'Output as JSON')
  .action(credentialCommands.list);

credential
  .command('get <id>')
  .description('Get credential details (without secret data)')
  .option('--json', 'Output as JSON')
  .action(credentialCommands.get);

credential
  .command('create')
  .description('Create a new credential')
  .option('-t, --type <type>', 'Credential type')
  .option('-n, --name <name>', 'Credential name')
  .option('-f, --file <file>', 'Import from JSON file')
  .action(credentialCommands.create);

credential
  .command('delete <id>')
  .description('Delete a credential')
  .option('-f, --force', 'Skip confirmation')
  .action(credentialCommands.delete);

credential
  .command('types')
  .description('List available credential types')
  .option('--json', 'Output as JSON')
  .action(credentialCommands.types);

// Execution commands
const execution = program
  .command('execution')
  .alias('exec')
  .description('Manage executions');

execution
  .command('list')
  .alias('ls')
  .description('List executions')
  .option('-w, --workflow <id>', 'Filter by workflow ID')
  .option('-s, --status <status>', 'Filter by status (success, error, running, waiting)')
  .option('-l, --limit <n>', 'Limit results', '20')
  .option('--json', 'Output as JSON')
  .action(executionCommands.list);

execution
  .command('get <id>')
  .description('Get execution details')
  .option('--json', 'Output as JSON')
  .action(executionCommands.get);

execution
  .command('stop <id>')
  .description('Stop a running execution')
  .action(executionCommands.stop);

execution
  .command('retry <id>')
  .description('Retry a failed execution')
  .action(executionCommands.retry);

execution
  .command('delete <id>')
  .description('Delete an execution')
  .option('-f, --force', 'Skip confirmation')
  .action(executionCommands.delete);

execution
  .command('logs <id>')
  .description('View execution logs')
  .option('-f, --follow', 'Follow logs in real-time')
  .action(executionCommands.logs);

// Import/Export commands
const importExport = program
  .command('export')
  .description('Export workflows and credentials');

importExport
  .command('workflow <id>')
  .description('Export a workflow')
  .option('-o, --output <file>', 'Output file path')
  .option('--with-credentials', 'Include credential data')
  .action(importExportCommands.exportWorkflow);

importExport
  .command('all')
  .description('Export all workflows')
  .option('-o, --output <dir>', 'Output directory')
  .option('--with-credentials', 'Include credential data')
  .action(importExportCommands.exportAll);

const importCmd = program
  .command('import')
  .description('Import workflows and credentials');

importCmd
  .command('workflow <file>')
  .description('Import a workflow from file')
  .option('--overwrite', 'Overwrite existing workflow')
  .action(importExportCommands.importWorkflow);

importCmd
  .command('dir <directory>')
  .description('Import all workflows from directory')
  .option('--overwrite', 'Overwrite existing workflows')
  .action(importExportCommands.importDirectory);

// Config commands
const configCmd = program
  .command('config')
  .description('Manage CLI configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(configCommands.set);

configCmd
  .command('get [key]')
  .description('Get configuration value(s)')
  .action(configCommands.get);

configCmd
  .command('list')
  .description('List all configuration values')
  .action(configCommands.list);

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(configCommands.reset);

// Server commands
const server = program
  .command('server')
  .description('Server management commands');

server
  .command('health')
  .description('Check server health')
  .action(serverCommands.health);

server
  .command('info')
  .description('Get server information')
  .action(serverCommands.info);

server
  .command('metrics')
  .description('Get server metrics')
  .action(serverCommands.metrics);

// Open UI command
program
  .command('ui')
  .description('Open AgentSmith UI in browser')
  .action(async () => {
    const open = (await import('open')).default;
    const url = config.get('apiUrl')?.replace('/api/v1', '') || 'http://localhost:5678';
    console.log(chalk.cyan(`Opening ${url}...`));
    await open(url);
  });

// Version with more details
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(banner);
    console.log(chalk.white('CLI Version:'), chalk.green('1.0.0'));
    console.log(chalk.white('Node Version:'), chalk.green(process.version));
    console.log(chalk.white('Platform:'), chalk.green(process.platform));
    console.log(chalk.white('API URL:'), chalk.green(config.get('apiUrl') || 'Not configured'));
  });

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (err: any) {
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}

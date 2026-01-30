/**
 * Config Commands
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { config } from '../config.js';
import { api } from '../api.js';

export const configCommands = {
  async set(key: string, value: string) {
    const validKeys = ['apiUrl', 'apiKey', 'defaultWorkspace', 'outputFormat', 'colorOutput', 'timeout'];

    if (!validKeys.includes(key)) {
      console.error(chalk.red(`Invalid config key. Valid keys: ${validKeys.join(', ')}`));
      return;
    }

    // Parse value based on key type
    let parsedValue: any = value;
    if (key === 'timeout') {
      parsedValue = parseInt(value, 10);
    } else if (key === 'colorOutput') {
      parsedValue = value === 'true';
    }

    config.set(key as any, parsedValue);
    console.log(chalk.green(`Set ${key} = ${value}`));
  },

  async get(key?: string) {
    if (key) {
      const value = config.get(key as any);
      if (value === undefined) {
        console.log(chalk.yellow(`Config key "${key}" is not set.`));
      } else {
        console.log(chalk.white(`${key}:`), value);
      }
    } else {
      configCommands.list();
    }
  },

  async list() {
    console.log(chalk.cyan('\nCLI Configuration'));
    console.log(chalk.gray('─'.repeat(50)));

    const keys = ['apiUrl', 'apiKey', 'defaultWorkspace', 'outputFormat', 'colorOutput', 'timeout'];

    for (const key of keys) {
      const value = config.get(key as any);
      const displayValue = key === 'apiKey' && value ? '****' + value.slice(-4) : value || chalk.gray('(not set)');
      console.log(chalk.white(`${key}:`), displayValue);
    }

    console.log(chalk.gray(`\nConfig file: ${config.path}`));
  },

  async reset() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Reset all configuration to defaults?',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }

    config.clear();
    console.log(chalk.green('Configuration reset to defaults.'));
  },
};

export async function initConfig(options: { url?: string; apiKey?: string }) {
  console.log(chalk.cyan('\nAgentSmith CLI Setup'));
  console.log(chalk.gray('─'.repeat(50)));

  let apiUrl = options.url;
  let apiKey = options.apiKey;

  if (!apiUrl) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiUrl',
        message: 'API URL:',
        default: 'http://localhost:5678/api/v1',
      },
    ]);
    apiUrl = answer.apiUrl;
  }

  // Test connection
  const spinner = ora('Testing connection...').start();
  config.set('apiUrl', apiUrl);

  try {
    await api.getHealth();
    spinner.succeed(chalk.green('Connected to AgentSmith'));
  } catch (error) {
    spinner.warn(chalk.yellow('Could not connect. The server may not be running.'));
  }

  if (!apiKey) {
    const { needsKey } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'needsKey',
        message: 'Does your server require an API key?',
        default: false,
      },
    ]);

    if (needsKey) {
      const answer = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
        },
      ]);
      apiKey = answer.apiKey;
    }
  }

  if (apiKey) {
    config.set('apiKey', apiKey);
  }

  console.log(chalk.green('\nConfiguration saved!'));
  console.log(chalk.gray(`Config file: ${config.path}`));
  console.log(chalk.cyan('\nTry these commands:'));
  console.log('  agentsmith status        - Check server status');
  console.log('  agentsmith workflow list - List all workflows');
  console.log('  agentsmith --help        - Show all commands');
}

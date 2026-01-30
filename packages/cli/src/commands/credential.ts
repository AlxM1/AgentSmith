/**
 * Credential Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { readFile } from 'fs/promises';
import { api } from '../api.js';

export const credentialCommands = {
  async list(options: { type?: string; json?: boolean }) {
    const spinner = ora('Fetching credentials...').start();

    try {
      const credentials = await api.listCredentials({ type: options.type });
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(credentials, null, 2));
        return;
      }

      if (credentials.length === 0) {
        console.log(chalk.yellow('No credentials found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Name'),
          chalk.cyan('Type'),
          chalk.cyan('Created'),
        ],
        colWidths: [38, 30, 25, 20],
      });

      for (const cred of credentials) {
        table.push([
          cred.id,
          cred.name.substring(0, 28),
          cred.type,
          new Date(cred.createdAt).toLocaleDateString(),
        ]);
      }

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${credentials.length} credentials`));
    } catch (error) {
      spinner.fail('Failed to fetch credentials');
    }
  },

  async get(id: string, options: { json?: boolean }) {
    const spinner = ora('Fetching credential...').start();

    try {
      const credential = await api.getCredential(id);
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(credential, null, 2));
        return;
      }

      console.log(chalk.cyan('\nCredential Details'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('ID:'), credential.id);
      console.log(chalk.white('Name:'), credential.name);
      console.log(chalk.white('Type:'), credential.type);
      console.log(chalk.white('Created:'), new Date(credential.createdAt).toLocaleString());
      console.log(chalk.white('Updated:'), new Date(credential.updatedAt).toLocaleString());
      console.log(chalk.gray('\nNote: Credential data is not displayed for security reasons.'));
    } catch (error) {
      spinner.fail('Failed to fetch credential');
    }
  },

  async create(options: { type?: string; name?: string; file?: string }) {
    try {
      let credentialData: any;

      if (options.file) {
        const content = await readFile(options.file, 'utf-8');
        credentialData = JSON.parse(content);
      } else {
        // Get available credential types
        const spinner = ora('Fetching credential types...').start();
        const types = await api.getCredentialTypes();
        spinner.stop();

        const typeChoices = types.map((t: any) => ({
          name: `${t.displayName} (${t.name})`,
          value: t.name,
        }));

        const typeAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'Select credential type:',
            choices: typeChoices,
            default: options.type,
          },
        ]);

        const selectedType = types.find((t: any) => t.name === typeAnswer.type);

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Credential name:',
            default: options.name || `My ${selectedType.displayName}`,
          },
        ]);

        // Prompt for each required field
        const dataAnswers: any = {};
        if (selectedType.properties) {
          for (const prop of selectedType.properties) {
            const answer = await inquirer.prompt([
              {
                type: prop.type === 'password' ? 'password' : 'input',
                name: prop.name,
                message: `${prop.displayName}:`,
                default: prop.default,
              },
            ]);
            dataAnswers[prop.name] = answer[prop.name];
          }
        }

        credentialData = {
          name: answers.name,
          type: typeAnswer.type,
          data: dataAnswers,
        };
      }

      const spinner = ora('Creating credential...').start();
      const credential = await api.createCredential(credentialData);
      spinner.succeed(chalk.green(`Credential created: ${credential.id}`));
    } catch (error: any) {
      console.error(chalk.red('Failed to create credential:'), error.message);
    }
  },

  async delete(id: string, options: { force?: boolean }) {
    try {
      if (!options.force) {
        const credential = await api.getCredential(id);
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete credential "${credential.name}"?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      const spinner = ora('Deleting credential...').start();
      await api.deleteCredential(id);
      spinner.succeed(chalk.green('Credential deleted'));
    } catch (error: any) {
      console.error(chalk.red('Failed to delete credential:'), error.message);
    }
  },

  async types(options: { json?: boolean }) {
    const spinner = ora('Fetching credential types...').start();

    try {
      const types = await api.getCredentialTypes();
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(types, null, 2));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('Name'),
          chalk.cyan('Display Name'),
          chalk.cyan('Category'),
        ],
        colWidths: [30, 35, 20],
      });

      for (const type of types) {
        table.push([
          type.name,
          type.displayName,
          type.category || 'General',
        ]);
      }

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${types.length} credential types`));
    } catch (error) {
      spinner.fail('Failed to fetch credential types');
    }
  },
};

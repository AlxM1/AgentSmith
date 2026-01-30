/**
 * Import/Export Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { glob } from 'glob';
import inquirer from 'inquirer';
import { api } from '../api.js';

export const importExportCommands = {
  async exportWorkflow(id: string, options: { output?: string; withCredentials?: boolean }) {
    const spinner = ora('Exporting workflow...').start();

    try {
      const workflow = await api.exportWorkflow(id, {
        withCredentials: options.withCredentials,
      });

      const filename = options.output || `${sanitizeFilename(workflow.name)}.json`;

      await writeFile(filename, JSON.stringify(workflow, null, 2));
      spinner.succeed(chalk.green(`Workflow exported to ${filename}`));

      if (options.withCredentials) {
        console.log(chalk.yellow('\nWarning: This file contains credential data. Keep it secure.'));
      }
    } catch (error: any) {
      spinner.fail('Failed to export workflow');
      console.error(chalk.red(error.message));
    }
  },

  async exportAll(options: { output?: string; withCredentials?: boolean }) {
    const spinner = ora('Fetching workflows...').start();

    try {
      const workflows = await api.listWorkflows({});
      spinner.text = `Exporting ${workflows.length} workflows...`;

      const outputDir = options.output || './agentsmith-export';

      try {
        await mkdir(outputDir, { recursive: true });
      } catch (e) {
        // Directory exists
      }

      let exported = 0;
      let failed = 0;

      for (const wf of workflows) {
        try {
          const workflow = await api.exportWorkflow(wf.id, {
            withCredentials: options.withCredentials,
          });

          const filename = join(outputDir, `${sanitizeFilename(workflow.name)}.json`);
          await writeFile(filename, JSON.stringify(workflow, null, 2));
          exported++;
        } catch (e) {
          failed++;
        }
      }

      spinner.succeed(chalk.green(`Exported ${exported} workflows to ${outputDir}`));

      if (failed > 0) {
        console.log(chalk.yellow(`Failed to export ${failed} workflows`));
      }

      // Create manifest
      const manifest = {
        exportedAt: new Date().toISOString(),
        count: exported,
        workflows: workflows.map(wf => ({
          id: wf.id,
          name: wf.name,
          file: `${sanitizeFilename(wf.name)}.json`,
        })),
      };

      await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log(chalk.gray(`Manifest saved to ${join(outputDir, 'manifest.json')}`));
    } catch (error: any) {
      spinner.fail('Failed to export workflows');
      console.error(chalk.red(error.message));
    }
  },

  async importWorkflow(file: string, options: { overwrite?: boolean }) {
    const spinner = ora('Importing workflow...').start();

    try {
      const content = await readFile(file, 'utf-8');
      const workflowData = JSON.parse(content);

      // Validate basic structure
      if (!workflowData.name) {
        throw new Error('Invalid workflow file: missing name');
      }

      const result = await api.importWorkflow(workflowData, {
        overwrite: options.overwrite,
      });

      spinner.succeed(chalk.green(`Workflow imported: ${result.name} (${result.id})`));

      if (result.warnings?.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  - ${warning}`));
        }
      }
    } catch (error: any) {
      spinner.fail('Failed to import workflow');

      if (error.message.includes('already exists')) {
        console.log(chalk.yellow('A workflow with this name already exists.'));
        console.log(chalk.gray('Use --overwrite to replace it.'));
      } else {
        console.error(chalk.red(error.message));
      }
    }
  },

  async importDirectory(directory: string, options: { overwrite?: boolean }) {
    const spinner = ora('Scanning directory...').start();

    try {
      // Find all JSON files
      const pattern = join(directory, '**/*.json');
      const files = await glob(pattern);

      // Filter out manifest
      const workflowFiles = files.filter(f => !f.endsWith('manifest.json'));

      if (workflowFiles.length === 0) {
        spinner.warn(chalk.yellow('No workflow files found'));
        return;
      }

      spinner.text = `Found ${workflowFiles.length} workflow files`;

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Import ${workflowFiles.length} workflows?`,
          default: true,
        },
      ]);

      if (!confirm) {
        spinner.stop();
        console.log(chalk.yellow('Cancelled.'));
        return;
      }

      spinner.start('Importing workflows...');

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const file of workflowFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const workflowData = JSON.parse(content);

          if (!workflowData.name) {
            errors.push(`${basename(file)}: Invalid format (missing name)`);
            failed++;
            continue;
          }

          await api.importWorkflow(workflowData, {
            overwrite: options.overwrite,
          });

          imported++;
        } catch (e: any) {
          errors.push(`${basename(file)}: ${e.message}`);
          failed++;
        }
      }

      spinner.succeed(chalk.green(`Imported ${imported} workflows`));

      if (failed > 0) {
        console.log(chalk.yellow(`\nFailed to import ${failed} workflows:`));
        for (const error of errors.slice(0, 10)) {
          console.log(chalk.red(`  - ${error}`));
        }
        if (errors.length > 10) {
          console.log(chalk.gray(`  ... and ${errors.length - 10} more`));
        }
      }
    } catch (error: any) {
      spinner.fail('Failed to import workflows');
      console.error(chalk.red(error.message));
    }
  },
};

// Helper function to sanitize filename
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 100);
}

/**
 * Git Source Control Service
 *
 * Enterprise feature for Git-based workflow version control:
 * - Push workflows to Git repositories
 * - Pull workflows from Git repositories
 * - Branch management
 * - Environment-based deployments
 * - PR-based workflow promotion
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';
import type { IWorkflow } from '@agentsmith/shared';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface GitConfig {
  enabled: boolean;
  repositoryUrl: string;
  branch: string;
  username?: string;
  password?: string;
  sshKeyPath?: string;
  authorName: string;
  authorEmail: string;
  workflowsPath: string;
  credentialsPath?: string;
  autoSync?: boolean;
  syncIntervalMs?: number;
}

export interface GitStatus {
  isClean: boolean;
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: string;
}

export interface WorkflowFile {
  id: string;
  name: string;
  path: string;
  workflow: IWorkflow;
  lastModified: Date;
  hash: string;
}

export interface SyncResult {
  success: boolean;
  pushed: string[];
  pulled: string[];
  conflicts: string[];
  errors: string[];
}

// ============================================================================
// GIT SOURCE CONTROL SERVICE
// ============================================================================

class GitSourceControlService {
  private config: GitConfig | null = null;
  private repoPath: string = '';
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isSyncing = false;

  /**
   * Initialize the Git source control service
   */
  async initialize(config: GitConfig): Promise<void> {
    this.config = config;

    if (!config.enabled) {
      logger.info('Git source control disabled');
      return;
    }

    // Create temp directory for repository
    this.repoPath = path.join(process.cwd(), '.git-sync', crypto.randomBytes(8).toString('hex'));
    await fs.mkdir(this.repoPath, { recursive: true });

    try {
      // Clone or initialize repository
      if (config.repositoryUrl) {
        await this.cloneRepository();
      } else {
        await this.initRepository();
      }

      this.isInitialized = true;

      // Start auto-sync if enabled
      if (config.autoSync) {
        this.startAutoSync();
      }

      logger.info('Git source control initialized', {
        repository: config.repositoryUrl,
        branch: config.branch,
      });
    } catch (error) {
      logger.error('Failed to initialize Git source control', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clone the remote repository
   */
  private async cloneRepository(): Promise<void> {
    if (!this.config) throw new Error('Git not configured');

    const repoUrl = this.getAuthenticatedUrl();
    const branch = this.config.branch || 'main';

    await execAsync(`git clone --branch ${branch} --single-branch ${repoUrl} .`, {
      cwd: this.repoPath,
    });

    // Configure git user
    await this.configureGitUser();
  }

  /**
   * Initialize a new repository
   */
  private async initRepository(): Promise<void> {
    if (!this.config) throw new Error('Git not configured');

    await execAsync('git init', { cwd: this.repoPath });
    await this.configureGitUser();

    // Create initial structure
    const workflowsDir = path.join(this.repoPath, this.config.workflowsPath);
    await fs.mkdir(workflowsDir, { recursive: true });
    await fs.writeFile(path.join(workflowsDir, '.gitkeep'), '');

    await execAsync('git add .', { cwd: this.repoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: this.repoPath });
  }

  /**
   * Configure Git user for commits
   */
  private async configureGitUser(): Promise<void> {
    if (!this.config) return;

    await execAsync(`git config user.name "${this.config.authorName}"`, { cwd: this.repoPath });
    await execAsync(`git config user.email "${this.config.authorEmail}"`, { cwd: this.repoPath });
  }

  /**
   * Get authenticated repository URL
   */
  private getAuthenticatedUrl(): string {
    if (!this.config?.repositoryUrl) return '';

    const url = new URL(this.config.repositoryUrl);

    if (this.config.username && this.config.password) {
      url.username = this.config.username;
      url.password = this.config.password;
    }

    return url.toString();
  }

  /**
   * Push a workflow to Git
   */
  async pushWorkflow(workflow: IWorkflow, message?: string): Promise<GitCommit> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Git source control not initialized');
    }

    const workflowPath = this.getWorkflowPath(workflow.id);
    const relativePath = path.relative(this.repoPath, workflowPath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(workflowPath), { recursive: true });

    // Write workflow JSON
    const workflowData = {
      ...workflow,
      _meta: {
        exportedAt: new Date().toISOString(),
        version: workflow.versionId || 1,
      },
    };

    await fs.writeFile(workflowPath, JSON.stringify(workflowData, null, 2), 'utf-8');

    // Stage and commit
    await execAsync(`git add "${relativePath}"`, { cwd: this.repoPath });

    const commitMessage = message || `Update workflow: ${workflow.name}`;
    await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
      cwd: this.repoPath,
    });

    // Push to remote if configured
    if (this.config.repositoryUrl) {
      await execAsync(`git push origin ${this.config.branch}`, { cwd: this.repoPath });
    }

    // Get commit info
    const commit = await this.getLastCommit();

    logger.info('Pushed workflow to Git', {
      workflowId: workflow.id,
      commit: commit.shortHash,
    });

    return commit;
  }

  /**
   * Pull a workflow from Git
   */
  async pullWorkflow(workflowId: string): Promise<IWorkflow | null> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Git source control not initialized');
    }

    // Pull latest changes
    if (this.config.repositoryUrl) {
      await execAsync(`git pull origin ${this.config.branch}`, { cwd: this.repoPath });
    }

    const workflowPath = this.getWorkflowPath(workflowId);

    try {
      const content = await fs.readFile(workflowPath, 'utf-8');
      const workflow = JSON.parse(content) as IWorkflow;

      logger.info('Pulled workflow from Git', { workflowId });

      return workflow;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a workflow from Git
   */
  async deleteWorkflow(workflowId: string, message?: string): Promise<GitCommit | null> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Git source control not initialized');
    }

    const workflowPath = this.getWorkflowPath(workflowId);
    const relativePath = path.relative(this.repoPath, workflowPath);

    try {
      await fs.unlink(workflowPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    await execAsync(`git add "${relativePath}"`, { cwd: this.repoPath });
    const commitMessage = message || `Delete workflow: ${workflowId}`;
    await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.repoPath });

    if (this.config.repositoryUrl) {
      await execAsync(`git push origin ${this.config.branch}`, { cwd: this.repoPath });
    }

    return this.getLastCommit();
  }

  /**
   * List all workflows in Git
   */
  async listWorkflows(): Promise<WorkflowFile[]> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Git source control not initialized');
    }

    const workflowsDir = path.join(this.repoPath, this.config.workflowsPath);
    const workflows: WorkflowFile[] = [];

    try {
      const files = await fs.readdir(workflowsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(workflowsDir, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const workflow = JSON.parse(content) as IWorkflow;

        workflows.push({
          id: workflow.id,
          name: workflow.name,
          path: file,
          workflow,
          lastModified: stats.mtime,
          hash: crypto.createHash('sha256').update(content).digest('hex').substring(0, 8),
        });
      }

      return workflows;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Sync all workflows with database
   */
  async syncWithDatabase(
    localWorkflows: IWorkflow[],
    strategy: 'push' | 'pull' | 'merge' = 'merge'
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        pushed: [],
        pulled: [],
        conflicts: [],
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      pushed: [],
      pulled: [],
      conflicts: [],
      errors: [],
    };

    try {
      // Pull latest from remote
      if (this.config?.repositoryUrl) {
        await execAsync(`git pull origin ${this.config.branch}`, { cwd: this.repoPath });
      }

      const gitWorkflows = await this.listWorkflows();
      const gitMap = new Map(gitWorkflows.map((w) => [w.id, w]));
      const localMap = new Map(localWorkflows.map((w) => [w.id, w]));

      if (strategy === 'push' || strategy === 'merge') {
        // Push local changes to Git
        for (const workflow of localWorkflows) {
          const gitWorkflow = gitMap.get(workflow.id);

          if (!gitWorkflow || this.workflowNeedsUpdate(workflow, gitWorkflow.workflow)) {
            try {
              await this.pushWorkflow(workflow);
              result.pushed.push(workflow.id);
            } catch (error: any) {
              result.errors.push(`Failed to push ${workflow.id}: ${error.message}`);
            }
          }
        }
      }

      if (strategy === 'pull' || strategy === 'merge') {
        // Pull Git workflows that are newer
        for (const gitFile of gitWorkflows) {
          const localWorkflow = localMap.get(gitFile.id);

          if (!localWorkflow) {
            result.pulled.push(gitFile.id);
          } else if (this.workflowNeedsUpdate(gitFile.workflow, localWorkflow)) {
            if (strategy === 'merge') {
              // Conflict detection
              result.conflicts.push(gitFile.id);
            } else {
              result.pulled.push(gitFile.id);
            }
          }
        }
      }

      // Push all changes to remote
      if (result.pushed.length > 0 && this.config?.repositoryUrl) {
        await execAsync(`git push origin ${this.config.branch}`, { cwd: this.repoPath });
      }

      logger.info('Git sync completed', {
        pushed: result.pushed.length,
        pulled: result.pulled.length,
        conflicts: result.conflicts.length,
      });
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      logger.error('Git sync failed', { error: error.message });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: this.repoPath,
    });

    const { stdout: branchOutput } = await execAsync('git branch --show-current', {
      cwd: this.repoPath,
    });

    let ahead = 0;
    let behind = 0;

    if (this.config?.repositoryUrl) {
      try {
        await execAsync('git fetch', { cwd: this.repoPath });
        const { stdout: revOutput } = await execAsync(
          `git rev-list --left-right --count HEAD...origin/${this.config.branch}`,
          { cwd: this.repoPath }
        );
        const [a, b] = revOutput.trim().split('\t');
        ahead = parseInt(a) || 0;
        behind = parseInt(b) || 0;
      } catch {
        // Ignore fetch errors
      }
    }

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    for (const line of statusOutput.split('\n')) {
      if (!line.trim()) continue;
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status.includes('M')) modified.push(file);
      if (status.includes('A')) added.push(file);
      if (status.includes('D')) deleted.push(file);
      if (status === '??') untracked.push(file);
    }

    return {
      isClean: statusOutput.trim() === '',
      branch: branchOutput.trim(),
      ahead,
      behind,
      modified,
      added,
      deleted,
      untracked,
    };
  }

  /**
   * Get commit history
   */
  async getCommitHistory(limit: number = 50): Promise<GitCommit[]> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    const { stdout } = await execAsync(
      `git log --format="%H|%h|%an|%ae|%aI|%s" -n ${limit}`,
      { cwd: this.repoPath }
    );

    const commits: GitCommit[] = [];

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;

      const [hash, shortHash, author, email, date, message] = line.split('|');

      // Get files changed in this commit
      const { stdout: filesOutput } = await execAsync(
        `git show --name-only --format="" ${hash}`,
        { cwd: this.repoPath }
      );

      commits.push({
        hash,
        shortHash,
        author,
        email,
        date: new Date(date),
        message,
        files: filesOutput.split('\n').filter(Boolean),
      });
    }

    return commits;
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<GitBranch[]> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    const { stdout } = await execAsync('git branch -a -v', { cwd: this.repoPath });
    const branches: GitBranch[] = [];

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;

      const current = line.startsWith('*');
      const parts = line.replace('*', '').trim().split(/\s+/);
      const name = parts[0];
      const lastCommit = parts[1];

      if (name.startsWith('remotes/')) {
        const remoteName = name.replace('remotes/', '');
        branches.push({
          name: remoteName,
          current: false,
          remote: remoteName.split('/')[0],
          lastCommit,
        });
      } else {
        branches.push({
          name,
          current,
          lastCommit,
        });
      }
    }

    return branches;
  }

  /**
   * Create a new branch
   */
  async createBranch(name: string, checkout: boolean = true): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    if (checkout) {
      await execAsync(`git checkout -b ${name}`, { cwd: this.repoPath });
    } else {
      await execAsync(`git branch ${name}`, { cwd: this.repoPath });
    }

    logger.info('Created Git branch', { name });
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(name: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    await execAsync(`git checkout ${name}`, { cwd: this.repoPath });
    logger.info('Checked out Git branch', { name });
  }

  /**
   * Get workflow file diff
   */
  async getWorkflowDiff(workflowId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Git source control not initialized');
    }

    const relativePath = path.join(this.config!.workflowsPath, `${workflowId}.json`);

    try {
      const { stdout } = await execAsync(`git diff HEAD -- "${relativePath}"`, {
        cwd: this.repoPath,
      });
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Rollback workflow to a specific commit
   */
  async rollbackWorkflow(workflowId: string, commitHash: string): Promise<IWorkflow | null> {
    if (!this.isInitialized || !this.config) {
      throw new Error('Git source control not initialized');
    }

    const relativePath = path.join(this.config.workflowsPath, `${workflowId}.json`);

    try {
      const { stdout } = await execAsync(`git show ${commitHash}:${relativePath}`, {
        cwd: this.repoPath,
      });

      return JSON.parse(stdout) as IWorkflow;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getWorkflowPath(workflowId: string): string {
    return path.join(this.repoPath, this.config!.workflowsPath, `${workflowId}.json`);
  }

  private async getLastCommit(): Promise<GitCommit> {
    const { stdout } = await execAsync('git log -1 --format="%H|%h|%an|%ae|%aI|%s"', {
      cwd: this.repoPath,
    });

    const [hash, shortHash, author, email, date, message] = stdout.trim().split('|');

    return {
      hash,
      shortHash,
      author,
      email,
      date: new Date(date),
      message,
      files: [],
    };
  }

  private workflowNeedsUpdate(a: IWorkflow, b: IWorkflow): boolean {
    // Compare by version or updatedAt
    if (a.versionId !== b.versionId) return true;
    if (a.updatedAt !== b.updatedAt) return true;

    // Deep compare nodes and connections
    const aHash = crypto.createHash('sha256').update(JSON.stringify(a.nodes)).digest('hex');
    const bHash = crypto.createHash('sha256').update(JSON.stringify(b.nodes)).digest('hex');

    return aHash !== bHash;
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const interval = this.config?.syncIntervalMs || 5 * 60 * 1000; // 5 minutes default

    this.syncInterval = setInterval(async () => {
      try {
        await execAsync(`git pull origin ${this.config?.branch}`, { cwd: this.repoPath });
        logger.debug('Auto-synced with remote repository');
      } catch (error) {
        logger.warn('Auto-sync failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, interval);
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Cleanup temp directory
    if (this.repoPath) {
      try {
        await fs.rm(this.repoPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    this.isInitialized = false;
    logger.info('Git source control shut down');
  }
}

// Export singleton instance
export const gitSourceControlService = new GitSourceControlService();

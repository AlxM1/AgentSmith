// @ts-nocheck
/**
 * Multi-Tenancy: Workspace/Organization Service
 * Provides workspace isolation for workflows, credentials, and executions
 */

import { EventEmitter } from 'events';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  plan: 'free' | 'team' | 'business' | 'enterprise';
  settings: WorkspaceSettings;
  limits: WorkspaceLimits;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSettings {
  defaultEnvironment?: string;
  allowPublicWorkflows: boolean;
  allowExternalSharing: boolean;
  requireApprovalForProduction: boolean;
  executionRetentionDays: number;
  auditLogRetentionDays: number;
  allowedAuthMethods: ('password' | 'sso' | 'saml' | 'api_key')[];
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    favicon?: string;
  };
  securitySettings: {
    enforceIPAllowlist: boolean;
    ipAllowlist: string[];
    enforce2FA: boolean;
    sessionTimeoutMinutes: number;
  };
}

export interface WorkspaceLimits {
  maxUsers: number;
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxCredentials: number;
  maxStorageGB: number;
  maxConcurrentExecutions: number;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt: Date;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export type WorkspacePermission =
  | 'workspace:manage'
  | 'workspace:billing'
  | 'workspace:members'
  | 'workflow:create'
  | 'workflow:read'
  | 'workflow:update'
  | 'workflow:delete'
  | 'workflow:execute'
  | 'workflow:activate'
  | 'credential:create'
  | 'credential:read'
  | 'credential:update'
  | 'credential:delete'
  | 'execution:read'
  | 'execution:delete'
  | 'variable:manage'
  | 'audit:read';

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WorkspaceUsage {
  workspaceId: string;
  period: string; // YYYY-MM
  executionCount: number;
  activeWorkflows: number;
  storageUsedBytes: number;
  apiCalls: number;
}

// Default role permissions
const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
    'workspace:manage', 'workspace:billing', 'workspace:members',
    'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete', 'workflow:execute', 'workflow:activate',
    'credential:create', 'credential:read', 'credential:update', 'credential:delete',
    'execution:read', 'execution:delete',
    'variable:manage', 'audit:read',
  ],
  admin: [
    'workspace:members',
    'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete', 'workflow:execute', 'workflow:activate',
    'credential:create', 'credential:read', 'credential:update', 'credential:delete',
    'execution:read', 'execution:delete',
    'variable:manage', 'audit:read',
  ],
  member: [
    'workflow:create', 'workflow:read', 'workflow:update', 'workflow:execute', 'workflow:activate',
    'credential:create', 'credential:read', 'credential:update',
    'execution:read',
  ],
  viewer: [
    'workflow:read',
    'credential:read',
    'execution:read',
  ],
  guest: [
    'workflow:read',
    'execution:read',
  ],
};

// Plan limits
const PLAN_LIMITS: Record<string, WorkspaceLimits> = {
  free: {
    maxUsers: 3,
    maxWorkflows: 10,
    maxExecutionsPerMonth: 1000,
    maxCredentials: 10,
    maxStorageGB: 1,
    maxConcurrentExecutions: 2,
  },
  team: {
    maxUsers: 10,
    maxWorkflows: 100,
    maxExecutionsPerMonth: 10000,
    maxCredentials: 50,
    maxStorageGB: 10,
    maxConcurrentExecutions: 5,
  },
  business: {
    maxUsers: 50,
    maxWorkflows: 500,
    maxExecutionsPerMonth: 100000,
    maxCredentials: 200,
    maxStorageGB: 50,
    maxConcurrentExecutions: 20,
  },
  enterprise: {
    maxUsers: -1, // Unlimited
    maxWorkflows: -1,
    maxExecutionsPerMonth: -1,
    maxCredentials: -1,
    maxStorageGB: -1,
    maxConcurrentExecutions: -1,
  },
};

class WorkspaceService extends EventEmitter {
  private workspaces: Map<string, Workspace> = new Map();
  private members: Map<string, WorkspaceMember[]> = new Map();
  private invites: Map<string, WorkspaceInvite> = new Map();
  private usage: Map<string, WorkspaceUsage> = new Map();

  /**
   * Create a new workspace
   */
  async createWorkspace(
    name: string,
    ownerId: string,
    options?: Partial<Pick<Workspace, 'description' | 'plan' | 'settings'>>
  ): Promise<Workspace> {
    const id = this.generateId();
    const slug = this.generateSlug(name);
    const plan = options?.plan || 'free';

    const workspace: Workspace = {
      id,
      name,
      slug,
      description: options?.description,
      ownerId,
      plan,
      settings: {
        allowPublicWorkflows: false,
        allowExternalSharing: false,
        requireApprovalForProduction: plan === 'enterprise',
        executionRetentionDays: plan === 'free' ? 7 : 30,
        auditLogRetentionDays: plan === 'enterprise' ? 365 : 90,
        allowedAuthMethods: ['password', 'sso'],
        securitySettings: {
          enforceIPAllowlist: false,
          ipAllowlist: [],
          enforce2FA: plan === 'enterprise',
          sessionTimeoutMinutes: 480,
        },
        ...options?.settings,
      },
      limits: PLAN_LIMITS[plan],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workspaces.set(id, workspace);

    // Add owner as member
    await this.addMember(id, ownerId, 'owner');

    this.emit('workspace:created', workspace);
    return workspace;
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  /**
   * Get workspace by slug
   */
  async getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return workspace;
      }
    }
    return null;
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    id: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'settings'>>
  ): Promise<Workspace | null> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return null;

    const updated: Workspace = {
      ...workspace,
      ...updates,
      settings: { ...workspace.settings, ...updates.settings },
      updatedAt: new Date(),
    };

    if (updates.name) {
      updated.slug = this.generateSlug(updates.name);
    }

    this.workspaces.set(id, updated);
    this.emit('workspace:updated', updated);
    return updated;
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<boolean> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return false;

    this.workspaces.delete(id);
    this.members.delete(id);

    this.emit('workspace:deleted', workspace);
    return true;
  }

  /**
   * Get workspaces for a user
   */
  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const userWorkspaces: Workspace[] = [];

    for (const [workspaceId, members] of this.members.entries()) {
      const isMember = members.some(m => m.userId === userId);
      if (isMember) {
        const workspace = this.workspaces.get(workspaceId);
        if (workspace) {
          userWorkspaces.push(workspace);
        }
      }
    }

    return userWorkspaces;
  }

  /**
   * Add member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    invitedBy?: string
  ): Promise<WorkspaceMember> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check limits
    const currentMembers = this.members.get(workspaceId) || [];
    if (workspace.limits.maxUsers !== -1 && currentMembers.length >= workspace.limits.maxUsers) {
      throw new Error('Workspace member limit reached');
    }

    const member: WorkspaceMember = {
      id: this.generateId(),
      workspaceId,
      userId,
      role,
      permissions: ROLE_PERMISSIONS[role],
      invitedBy,
      invitedAt: invitedBy ? new Date() : undefined,
      joinedAt: new Date(),
    };

    const members = this.members.get(workspaceId) || [];
    members.push(member);
    this.members.set(workspaceId, members);

    this.emit('member:added', member);
    return member;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole
  ): Promise<WorkspaceMember | null> {
    const members = this.members.get(workspaceId) || [];
    const memberIndex = members.findIndex(m => m.userId === userId);

    if (memberIndex === -1) return null;

    // Cannot change owner role
    if (members[memberIndex].role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    members[memberIndex] = {
      ...members[memberIndex],
      role: newRole,
      permissions: ROLE_PERMISSIONS[newRole],
    };

    this.members.set(workspaceId, members);
    this.emit('member:updated', members[memberIndex]);
    return members[memberIndex];
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const members = this.members.get(workspaceId) || [];
    const member = members.find(m => m.userId === userId);

    if (!member) return false;

    // Cannot remove owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove workspace owner');
    }

    const filtered = members.filter(m => m.userId !== userId);
    this.members.set(workspaceId, filtered);

    this.emit('member:removed', member);
    return true;
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.members.get(workspaceId) || [];
  }

  /**
   * Get member by user ID
   */
  async getMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const members = this.members.get(workspaceId) || [];
    return members.find(m => m.userId === userId) || null;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    workspaceId: string,
    userId: string,
    permission: WorkspacePermission
  ): Promise<boolean> {
    const member = await this.getMember(workspaceId, userId);
    if (!member) return false;
    return member.permissions.includes(permission);
  }

  /**
   * Create workspace invite
   */
  async createInvite(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedBy: string
  ): Promise<WorkspaceInvite> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const invite: WorkspaceInvite = {
      id: this.generateId(),
      workspaceId,
      email,
      role,
      token: this.generateToken(),
      invitedBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };

    this.invites.set(invite.token, invite);
    this.emit('invite:created', invite);
    return invite;
  }

  /**
   * Accept workspace invite
   */
  async acceptInvite(token: string, userId: string): Promise<WorkspaceMember> {
    const invite = this.invites.get(token);

    if (!invite) {
      throw new Error('Invalid invite');
    }

    if (new Date() > invite.expiresAt) {
      this.invites.delete(token);
      throw new Error('Invite expired');
    }

    const member = await this.addMember(
      invite.workspaceId,
      userId,
      invite.role,
      invite.invitedBy
    );

    this.invites.delete(token);
    this.emit('invite:accepted', invite, member);
    return member;
  }

  /**
   * Get workspace usage
   */
  async getUsage(workspaceId: string, period?: string): Promise<WorkspaceUsage | null> {
    const currentPeriod = period || new Date().toISOString().substring(0, 7);
    const key = `${workspaceId}:${currentPeriod}`;
    return this.usage.get(key) || null;
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(
    workspaceId: string,
    metric: 'executionCount' | 'apiCalls',
    amount: number = 1
  ): Promise<void> {
    const period = new Date().toISOString().substring(0, 7);
    const key = `${workspaceId}:${period}`;

    let usage = this.usage.get(key);
    if (!usage) {
      usage = {
        workspaceId,
        period,
        executionCount: 0,
        activeWorkflows: 0,
        storageUsedBytes: 0,
        apiCalls: 0,
      };
    }

    usage[metric] += amount;
    this.usage.set(key, usage);
  }

  /**
   * Check if within usage limits
   */
  async checkLimits(
    workspaceId: string,
    resource: keyof WorkspaceLimits
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const limit = workspace.limits[resource];
    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    let current = 0;

    switch (resource) {
      case 'maxUsers':
        current = (this.members.get(workspaceId) || []).length;
        break;
      case 'maxExecutionsPerMonth':
        const usage = await this.getUsage(workspaceId);
        current = usage?.executionCount || 0;
        break;
      // Add other resource checks as needed
    }

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }

  /**
   * Transfer workspace ownership
   */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId !== currentOwnerId) {
      throw new Error('Only the owner can transfer ownership');
    }

    const members = this.members.get(workspaceId) || [];
    const newOwnerMember = members.find(m => m.userId === newOwnerId);

    if (!newOwnerMember) {
      throw new Error('New owner must be a workspace member');
    }

    // Update current owner to admin
    const currentOwnerIndex = members.findIndex(m => m.userId === currentOwnerId);
    if (currentOwnerIndex !== -1) {
      members[currentOwnerIndex] = {
        ...members[currentOwnerIndex],
        role: 'admin',
        permissions: ROLE_PERMISSIONS['admin'],
      };
    }

    // Update new owner
    const newOwnerIndex = members.findIndex(m => m.userId === newOwnerId);
    members[newOwnerIndex] = {
      ...members[newOwnerIndex],
      role: 'owner',
      permissions: ROLE_PERMISSIONS['owner'],
    };

    // Update workspace
    workspace.ownerId = newOwnerId;
    workspace.updatedAt = new Date();

    this.workspaces.set(workspaceId, workspace);
    this.members.set(workspaceId, members);

    this.emit('workspace:ownershipTransferred', workspace, currentOwnerId, newOwnerId);
  }

  // Helper methods
  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private generateToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}

export const workspaceService = new WorkspaceService();

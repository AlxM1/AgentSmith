/**
 * Role-Based Access Control (RBAC) Service
 *
 * Enterprise feature for granular permission management:
 * - Custom roles with specific permissions
 * - Resource-level permissions (workflows, credentials, projects)
 * - Permission inheritance
 * - Team/project-based access control
 */

import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { eq, and, or, inArray } from 'drizzle-orm';
import { users, workflows, credentials, credentialShares } from '../db/schema.js';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type Permission =
  // Workflow permissions
  | 'workflow:create'
  | 'workflow:read'
  | 'workflow:update'
  | 'workflow:delete'
  | 'workflow:execute'
  | 'workflow:share'
  | 'workflow:export'
  | 'workflow:import'
  // Credential permissions
  | 'credential:create'
  | 'credential:read'
  | 'credential:update'
  | 'credential:delete'
  | 'credential:share'
  | 'credential:use'
  // Execution permissions
  | 'execution:read'
  | 'execution:delete'
  | 'execution:retry'
  | 'execution:stop'
  // User management
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:invite'
  // Admin permissions
  | 'admin:settings'
  | 'admin:audit'
  | 'admin:license'
  | 'admin:backup'
  // Project permissions
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'project:manage_members'
  // Environment permissions
  | 'environment:read'
  | 'environment:promote'
  | 'environment:rollback';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  scope?: RoleScope;
  assignedAt: Date;
  assignedBy: string;
}

export interface RoleScope {
  type: 'global' | 'project' | 'workflow' | 'credential';
  resourceId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: ProjectMember[];
  workflows: string[];
  credentials: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  userId: string;
  roleId: string;
  addedAt: Date;
  addedBy: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  grantedBy?: string;
}

// ============================================================================
// DEFAULT ROLES
// ============================================================================

const SYSTEM_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'admin',
    description: 'Full system administrator with all permissions',
    isSystem: true,
    permissions: [
      'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete',
      'workflow:execute', 'workflow:share', 'workflow:export', 'workflow:import',
      'credential:create', 'credential:read', 'credential:update', 'credential:delete',
      'credential:share', 'credential:use',
      'execution:read', 'execution:delete', 'execution:retry', 'execution:stop',
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:invite',
      'admin:settings', 'admin:audit', 'admin:license', 'admin:backup',
      'project:create', 'project:read', 'project:update', 'project:delete', 'project:manage_members',
      'environment:read', 'environment:promote', 'environment:rollback',
    ],
  },
  {
    name: 'editor',
    description: 'Can create, edit, and execute workflows',
    isSystem: true,
    permissions: [
      'workflow:create', 'workflow:read', 'workflow:update', 'workflow:execute',
      'workflow:share', 'workflow:export', 'workflow:import',
      'credential:create', 'credential:read', 'credential:update', 'credential:use',
      'execution:read', 'execution:retry', 'execution:stop',
      'user:read',
      'project:read',
      'environment:read',
    ],
  },
  {
    name: 'operator',
    description: 'Can view and execute workflows',
    isSystem: true,
    permissions: [
      'workflow:read', 'workflow:execute',
      'credential:read', 'credential:use',
      'execution:read', 'execution:retry', 'execution:stop',
      'user:read',
      'project:read',
      'environment:read',
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only access to workflows and executions',
    isSystem: true,
    permissions: [
      'workflow:read',
      'credential:read',
      'execution:read',
      'user:read',
      'project:read',
      'environment:read',
    ],
  },
];

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const roleStore: Map<string, Role> = new Map();
const userRoles: Map<string, UserRole[]> = new Map();
const projectStore: Map<string, Project> = new Map();

// ============================================================================
// RBAC SERVICE
// ============================================================================

class RBACService {
  private isInitialized = false;

  /**
   * Initialize RBAC service with system roles
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create system roles
    for (const role of SYSTEM_ROLES) {
      const id = `role_${role.name}`;
      roleStore.set(id, {
        ...role,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    this.isInitialized = true;
    logger.info('RBAC service initialized', {
      systemRoles: SYSTEM_ROLES.map((r) => r.name),
    });
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  /**
   * Get all roles
   */
  getRoles(): Role[] {
    return Array.from(roleStore.values());
  }

  /**
   * Get role by ID or name
   */
  getRole(idOrName: string): Role | undefined {
    // Try by ID first
    let role = roleStore.get(idOrName);
    if (role) return role;

    // Try by name
    for (const r of roleStore.values()) {
      if (r.name === idOrName) return r;
    }

    return undefined;
  }

  /**
   * Create custom role
   */
  async createRole(data: {
    name: string;
    description?: string;
    permissions: Permission[];
  }): Promise<Role> {
    // Check for duplicate name
    for (const role of roleStore.values()) {
      if (role.name === data.name) {
        throw new Error(`Role with name "${data.name}" already exists`);
      }
    }

    const id = `role_${crypto.randomUUID().substring(0, 8)}`;

    const role: Role = {
      id,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    roleStore.set(id, role);

    logger.info('Created custom role', { id, name: data.name });

    return role;
  }

  /**
   * Update custom role
   */
  async updateRole(
    id: string,
    updates: Partial<Pick<Role, 'name' | 'description' | 'permissions'>>
  ): Promise<Role | null> {
    const role = roleStore.get(id);
    if (!role) return null;

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const updated: Role = {
      ...role,
      ...updates,
      updatedAt: new Date(),
    };

    roleStore.set(id, updated);

    logger.info('Updated role', { id });

    return updated;
  }

  /**
   * Delete custom role
   */
  async deleteRole(id: string): Promise<boolean> {
    const role = roleStore.get(id);
    if (!role) return false;

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    roleStore.delete(id);
    logger.info('Deleted role', { id });

    return true;
  }

  // ============================================================================
  // USER ROLE ASSIGNMENT
  // ============================================================================

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    scope?: RoleScope
  ): Promise<UserRole> {
    const role = roleStore.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const userRole: UserRole = {
      userId,
      roleId,
      scope,
      assignedAt: new Date(),
      assignedBy,
    };

    const roles = userRoles.get(userId) || [];

    // Remove existing role with same scope
    const filteredRoles = roles.filter((r) => {
      if (!scope && !r.scope) return r.roleId !== roleId;
      if (!scope || !r.scope) return true;
      return !(r.scope.type === scope.type && r.scope.resourceId === scope.resourceId);
    });

    filteredRoles.push(userRole);
    userRoles.set(userId, filteredRoles);

    logger.info('Assigned role to user', {
      userId,
      roleId,
      scope: scope?.type,
    });

    return userRole;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string, scope?: RoleScope): Promise<boolean> {
    const roles = userRoles.get(userId);
    if (!roles) return false;

    const originalLength = roles.length;
    const filteredRoles = roles.filter((r) => {
      if (r.roleId !== roleId) return true;
      if (!scope && !r.scope) return false;
      if (!scope || !r.scope) return true;
      return !(r.scope.type === scope.type && r.scope.resourceId === scope.resourceId);
    });

    if (filteredRoles.length === originalLength) {
      return false;
    }

    userRoles.set(userId, filteredRoles);

    logger.info('Removed role from user', { userId, roleId });

    return true;
  }

  /**
   * Get user's roles
   */
  getUserRoles(userId: string): UserRole[] {
    return userRoles.get(userId) || [];
  }

  /**
   * Get user's permissions
   */
  getUserPermissions(userId: string, scope?: RoleScope): Permission[] {
    const roles = userRoles.get(userId) || [];
    const permissions = new Set<Permission>();

    for (const userRole of roles) {
      // Check if role applies to scope
      if (scope && userRole.scope) {
        if (userRole.scope.type !== 'global' && userRole.scope.type !== scope.type) {
          continue;
        }
        if (userRole.scope.resourceId && userRole.scope.resourceId !== scope.resourceId) {
          continue;
        }
      }

      const role = roleStore.get(userRole.roleId);
      if (role) {
        for (const perm of role.permissions) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }

  // ============================================================================
  // PERMISSION CHECKS
  // ============================================================================

  /**
   * Check if user has permission
   */
  async checkPermission(
    userId: string,
    permission: Permission,
    resourceId?: string
  ): Promise<PermissionCheckResult> {
    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Admin users have all permissions
    if (user.role === 'admin') {
      return { allowed: true, grantedBy: 'admin_role' };
    }

    // Check user's assigned roles
    const userPermissions = this.getUserPermissions(userId, resourceId ? {
      type: this.getResourceType(permission),
      resourceId,
    } : undefined);

    if (userPermissions.includes(permission)) {
      return { allowed: true, grantedBy: 'role_permission' };
    }

    // Check resource-level sharing
    if (resourceId) {
      const hasResourceAccess = await this.checkResourceAccess(userId, permission, resourceId);
      if (hasResourceAccess) {
        return { allowed: true, grantedBy: 'resource_share' };
      }
    }

    return { allowed: false, reason: 'Permission not granted' };
  }

  /**
   * Check resource-level access
   */
  private async checkResourceAccess(
    userId: string,
    permission: Permission,
    resourceId: string
  ): Promise<boolean> {
    const resourceType = this.getResourceType(permission);

    if (resourceType === 'workflow') {
      // Check if user owns the workflow
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, resourceId),
      });

      if (workflow?.createdBy === userId) {
        return true;
      }

      // Check workflow sharing (would need workflow_shares table query)
      // For now, return false
    }

    if (resourceType === 'credential') {
      // Check if user owns the credential
      const credential = await db.query.credentials.findFirst({
        where: eq(credentials.id, resourceId),
      });

      if (credential?.createdBy === userId) {
        return true;
      }

      // Check credential sharing
      const share = await db.query.credentialShares.findFirst({
        where: and(
          eq(credentialShares.credentialId, resourceId),
          eq(credentialShares.userId, userId)
        ),
      });

      if (share) {
        // Check if share grants this permission
        const accessLevel = share.accessLevel;
        if (accessLevel === 'admin') return true;
        if (permission === 'credential:read' || permission === 'credential:use') return true;
        if (accessLevel === 'write' && permission === 'credential:update') return true;
      }
    }

    return false;
  }

  /**
   * Get resource type from permission
   */
  private getResourceType(permission: Permission): 'workflow' | 'credential' | 'project' | 'global' {
    if (permission.startsWith('workflow:')) return 'workflow';
    if (permission.startsWith('credential:')) return 'credential';
    if (permission.startsWith('project:')) return 'project';
    return 'global';
  }

  /**
   * Require permission (throws if not allowed)
   */
  async requirePermission(
    userId: string,
    permission: Permission,
    resourceId?: string
  ): Promise<void> {
    const result = await this.checkPermission(userId, permission, resourceId);

    if (!result.allowed) {
      throw new Error(`Permission denied: ${permission}. ${result.reason || ''}`);
    }
  }

  // ============================================================================
  // PROJECT MANAGEMENT
  // ============================================================================

  /**
   * Create project
   */
  async createProject(data: {
    name: string;
    description?: string;
    ownerId: string;
  }): Promise<Project> {
    const id = `proj_${crypto.randomUUID().substring(0, 8)}`;

    const project: Project = {
      id,
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      members: [
        {
          userId: data.ownerId,
          roleId: 'role_admin',
          addedAt: new Date(),
          addedBy: data.ownerId,
        },
      ],
      workflows: [],
      credentials: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    projectStore.set(id, project);

    logger.info('Created project', { id, name: data.name });

    return project;
  }

  /**
   * Get project
   */
  getProject(id: string): Project | undefined {
    return projectStore.get(id);
  }

  /**
   * Get user's projects
   */
  getUserProjects(userId: string): Project[] {
    const projects: Project[] = [];

    for (const project of projectStore.values()) {
      if (project.members.some((m) => m.userId === userId)) {
        projects.push(project);
      }
    }

    return projects;
  }

  /**
   * Add member to project
   */
  async addProjectMember(
    projectId: string,
    userId: string,
    roleId: string,
    addedBy: string
  ): Promise<ProjectMember> {
    const project = projectStore.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Check if user is already a member
    const existingMember = project.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new Error('User is already a member of this project');
    }

    const member: ProjectMember = {
      userId,
      roleId,
      addedAt: new Date(),
      addedBy,
    };

    project.members.push(member);
    project.updatedAt = new Date();

    // Assign scoped role
    await this.assignRole(userId, roleId, addedBy, {
      type: 'project',
      resourceId: projectId,
    });

    logger.info('Added project member', { projectId, userId });

    return member;
  }

  /**
   * Remove member from project
   */
  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const project = projectStore.get(projectId);
    if (!project) return false;

    if (project.ownerId === userId) {
      throw new Error('Cannot remove project owner');
    }

    const originalLength = project.members.length;
    project.members = project.members.filter((m) => m.userId !== userId);

    if (project.members.length === originalLength) {
      return false;
    }

    project.updatedAt = new Date();

    // Remove scoped roles
    const roles = userRoles.get(userId) || [];
    const filteredRoles = roles.filter(
      (r) => !(r.scope?.type === 'project' && r.scope?.resourceId === projectId)
    );
    userRoles.set(userId, filteredRoles);

    logger.info('Removed project member', { projectId, userId });

    return true;
  }

  /**
   * Add workflow to project
   */
  async addWorkflowToProject(projectId: string, workflowId: string): Promise<void> {
    const project = projectStore.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!project.workflows.includes(workflowId)) {
      project.workflows.push(workflowId);
      project.updatedAt = new Date();
    }
  }

  /**
   * Remove workflow from project
   */
  async removeWorkflowFromProject(projectId: string, workflowId: string): Promise<void> {
    const project = projectStore.get(projectId);
    if (!project) return;

    project.workflows = project.workflows.filter((id) => id !== workflowId);
    project.updatedAt = new Date();
  }

  // ============================================================================
  // BULK PERMISSION CHECKS
  // ============================================================================

  /**
   * Filter resources by permission
   */
  async filterByPermission<T extends { id: string }>(
    userId: string,
    permission: Permission,
    resources: T[]
  ): Promise<T[]> {
    const results: T[] = [];

    for (const resource of resources) {
      const check = await this.checkPermission(userId, permission, resource.id);
      if (check.allowed) {
        results.push(resource);
      }
    }

    return results;
  }

  /**
   * Get all permissions for display
   */
  getAllPermissions(): Permission[] {
    return [
      'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete',
      'workflow:execute', 'workflow:share', 'workflow:export', 'workflow:import',
      'credential:create', 'credential:read', 'credential:update', 'credential:delete',
      'credential:share', 'credential:use',
      'execution:read', 'execution:delete', 'execution:retry', 'execution:stop',
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:invite',
      'admin:settings', 'admin:audit', 'admin:license', 'admin:backup',
      'project:create', 'project:read', 'project:update', 'project:delete', 'project:manage_members',
      'environment:read', 'environment:promote', 'environment:rollback',
    ];
  }
}

// Export singleton instance
export const rbacService = new RBACService();

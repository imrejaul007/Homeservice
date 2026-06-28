import mongoose, { Document, Schema, ClientSession } from 'mongoose';
import { Role, Permission, PERMISSIONS, IRole, IPermission } from '../models/permission.model';
import { IUser, UserRole } from '../models/user.model';
import User from '../models/user.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import auditService from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface PermissionCheck {
  permission: string;
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface RoleWithPermissions extends IRole {
  permissionDetails?: IPermission[];
}

export interface CreateRoleDTO {
  name: string;
  description: string;
  permissions: string[];
  isSystem?: boolean;
}

export interface UpdateRoleDTO {
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface AssignRoleDTO {
  userId: string;
  roleName: string;
}

export interface BulkRoleAssignmentDTO {
  userIds: string[];
  roleName: string;
}

export interface RoleHierarchy {
  level: number;
  roles: string[];
}

// ============================================
// Permission Definitions
// ============================================

export const PERMISSION_CATEGORIES = {
  bookings: {
    label: 'Bookings',
    permissions: ['booking:create', 'booking:read', 'booking:read:all', 'booking:update', 'booking:update:all', 'booking:delete'],
  },
  services: {
    label: 'Services',
    permissions: ['service:create', 'service:read', 'service:read:all', 'service:update', 'service:update:all', 'service:delete'],
  },
  users: {
    label: 'Users',
    permissions: ['user:read', 'user:read:all', 'user:update', 'user:update:all', 'user:delete'],
  },
  providers: {
    label: 'Providers',
    permissions: ['provider:read', 'provider:read:all', 'provider:approve', 'provider:suspend', 'provider:delete'],
  },
  analytics: {
    label: 'Analytics',
    permissions: ['analytics:read', 'analytics:export', 'analytics:dashboard'],
  },
  settings: {
    label: 'Settings',
    permissions: ['settings:read', 'settings:manage', 'settings:system'],
  },
  finance: {
    label: 'Finance',
    permissions: ['finance:read', 'finance:manage', 'wallet:manage', 'payout:process', 'commission:view'],
  },
  content: {
    label: 'Content',
    permissions: ['content:create', 'content:read', 'content:update', 'content:delete', 'category:manage'],
  },
  security: {
    label: 'Security',
    permissions: ['security:audit', 'security:logs', 'security:configure', 'role:manage', 'permission:assign'],
  },
  compliance: {
    label: 'Compliance',
    permissions: ['compliance:view', 'compliance:reports', 'gdpr:manage', 'consent:manage'],
  },
} as const;

export const ADMIN_PERMISSION_HIERARCHY: RoleHierarchy[] = [
  { level: 1, roles: ['super_admin'] },
  { level: 2, roles: ['admin'] },
  { level: 3, roles: ['moderator'] },
  { level: 4, roles: ['support'] },
  { level: 5, roles: ['analyst'] },
];

// ============================================
// RBAC Service Class
// ============================================

export class RBACService {
  // ========================================
  // Role Management
  // ========================================

  /**
   * Create a new custom role
   */
  async createRole(
    data: CreateRoleDTO,
    createdBy: string
  ): Promise<IRole> {
    // Check if role already exists
    const existingRole = await Role.findOne({ name: data.name });
    if (existingRole) {
      throw new ApiError(
        409,
        `Role '${data.name}' already exists`,
        [],
        ERROR_CODES.DUPLICATE_ENTRY
      );
    }

    // Validate permissions exist
    await this.validatePermissions(data.permissions);

    // Create role
    const role = new Role({
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      isSystem: data.isSystem || false,
      isActive: true,
    });

    await role.save();

    // Audit log
    await auditService.logAction({
      action: 'role_created',
      userId: createdBy,
      targetType: 'role',
      targetId: role._id.toString(),
      metadata: {
        roleName: role.name,
        permissions: role.permissions,
      },
    });

    logger.info(`Role '${role.name}' created`, {
      roleId: role._id,
      createdBy,
    });

    return role;
  }

  /**
   * Update an existing role
   */
  async updateRole(
    roleId: string,
    data: UpdateRoleDTO,
    updatedBy: string
  ): Promise<IRole> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new ApiError(404, 'Role not found', [], ERROR_CODES.NOT_FOUND);
    }

    // Cannot modify system roles
    if (role.isSystem) {
      throw new ApiError(
        403,
        'System roles cannot be modified',
        [],
        ERROR_CODES.FORBIDDEN
      );
    }

    // Validate new permissions if provided
    if (data.permissions) {
      await this.validatePermissions(data.permissions);
      role.permissions = data.permissions;
    }

    if (data.description !== undefined) {
      role.description = data.description;
    }

    if (data.isActive !== undefined) {
      role.isActive = data.isActive;
    }

    await role.save();

    // Audit log
    await auditService.logAction({
      action: 'role_updated',
      userId: updatedBy,
      targetType: 'role',
      targetId: role._id.toString(),
      metadata: {
        roleName: role.name,
        changes: data,
      },
    });

    logger.info(`Role '${role.name}' updated`, {
      roleId: role._id,
      updatedBy,
    });

    return role;
  }

  /**
   * Delete a custom role
   */
  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new ApiError(404, 'Role not found', [], ERROR_CODES.NOT_FOUND);
    }

    // Cannot delete system roles
    if (role.isSystem) {
      throw new ApiError(
        403,
        'System roles cannot be deleted',
        [],
        ERROR_CODES.FORBIDDEN
      );
    }

    // Check if any users have this role
    const usersWithRole = await User.countDocuments({ role: role.name as UserRole });
    if (usersWithRole > 0) {
      throw new ApiError(
        400,
        `Cannot delete role: ${usersWithRole} users have this role assigned`,
        [],
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const roleName = role.name;
    await Role.deleteOne({ _id: roleId });

    // Audit log
    await auditService.logAction({
      action: 'role_deleted',
      userId: deletedBy,
      targetType: 'role',
      targetId: roleId,
      metadata: { roleName },
    });

    logger.info(`Role '${roleName}' deleted`, {
      roleId,
      deletedBy,
    });
  }

  /**
   * Get all roles
   */
  async getAllRoles(includeInactive: boolean = false): Promise<RoleWithPermissions[]> {
    const query = includeInactive ? {} : { isActive: true };
    const roles = await Role.find(query).sort({ name: 1 });

    // Populate permission details
    const rolesWithPermissions: RoleWithPermissions[] = await Promise.all(
      roles.map(async (role) => {
        const permissions = await Permission.find({
          _id: { $in: role.permissions },
        });
        return {
          ...role.toObject(),
          permissionDetails: permissions,
        } as unknown as RoleWithPermissions;
      })
    );

    return rolesWithPermissions;
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const role = await Role.findById(roleId);
    if (!role) {
      return null;
    }

    const permissions = await Permission.find({
      _id: { $in: role.permissions },
    });

    return {
      ...role.toObject(),
      permissionDetails: permissions,
    } as unknown as RoleWithPermissions;
  }

  /**
   * Get role by name
   */
  async getRoleByName(roleName: string): Promise<RoleWithPermissions | null> {
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return null;
    }

    const permissions = await Permission.find({
      _id: { $in: role.permissions },
    });

    return {
      ...role.toObject(),
      permissionDetails: permissions,
    } as unknown as RoleWithPermissions;
  }

  // ========================================
  // Permission Management
  // ========================================

  /**
   * Create a new permission
   */
  async createPermission(
    data: Omit<IPermission, 'createdAt' | '_id'>
  ): Promise<IPermission> {
    const existingPermission = await Permission.findOne({ name: data.name });
    if (existingPermission) {
      throw new ApiError(
        409,
        `Permission '${data.name}' already exists`,
        [],
        ERROR_CODES.DUPLICATE_ENTRY
      );
    }

    const permission = new Permission({
      name: data.name,
      description: data.description,
      resource: data.resource,
      action: data.action,
      conditions: data.conditions,
    });

    await permission.save();
    logger.info(`Permission '${permission.name}' created`);

    return permission;
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<IPermission[]> {
    return Permission.find().sort({ resource: 1, action: 1 });
  }

  /**
   * Get permissions by category
   */
  async getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): Promise<IPermission[]> {
    const categoryPermissions = PERMISSION_CATEGORIES[category].permissions;
    return Permission.find({ name: { $in: categoryPermissions } });
  }

  /**
   * Validate that all permissions exist
   */
  private async validatePermissions(permissions: string[]): Promise<void> {
    const existingPermissions = await Permission.find({
      name: { $in: permissions },
    }).select('name');

    const existingNames = new Set(existingPermissions.map((p) => p.name));
    const invalidPermissions = permissions.filter((p) => !existingNames.has(p));

    if (invalidPermissions.length > 0) {
      throw new ApiError(
        400,
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
        [],
        ERROR_CODES.INVALID_INPUT
      );
    }
  }

  // ========================================
  // User Role Assignment
  // ========================================

  /**
   * Assign a role to a user
   */
  async assignRole(
    data: AssignRoleDTO,
    assignedBy: string
  ): Promise<IUser> {
    const [user, role] = await Promise.all([
      User.findById(data.userId),
      Role.findOne({ name: data.roleName }),
    ]);

    if (!user) {
      throw new ApiError(404, 'User not found', [], ERROR_CODES.USER_NOT_FOUND);
    }

    if (!role) {
      throw new ApiError(404, 'Role not found', [], ERROR_CODES.NOT_FOUND);
    }

    if (!role.isActive) {
      throw new ApiError(400, 'Role is inactive', [], ERROR_CODES.VALIDATION_ERROR);
    }

    const previousRole = user.role;
    user.role = data.roleName as UserRole;
    await user.save();

    // Audit log
    await auditService.logAction({
      action: 'role_assigned',
      userId: assignedBy,
      targetType: 'user',
      targetId: user._id.toString(),
      metadata: {
        previousRole,
        newRole: data.roleName,
      },
    });

    logger.info(`Role '${data.roleName}' assigned to user`, {
      userId: user._id,
      assignedBy,
      previousRole,
      newRole: data.roleName,
    });

    return user;
  }

  /**
   * Bulk assign role to multiple users
   */
  async bulkAssignRole(
    data: BulkRoleAssignmentDTO,
    assignedBy: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const role = await Role.findOne({ name: data.roleName });
    if (!role) {
      throw new ApiError(404, 'Role not found', [], ERROR_CODES.NOT_FOUND);
    }

    if (!role.isActive) {
      throw new ApiError(400, 'Role is inactive', [], ERROR_CODES.VALIDATION_ERROR);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let success = 0;
    let failed = 0;

    try {
      // Bulk update user roles
      const result = await User.updateMany(
        { _id: { $in: data.userIds } },
        { $set: { role: data.roleName as UserRole } },
        { session }
      );

      success = result.modifiedCount;
      failed = data.userIds.length - success;

      await session.commitTransaction();

      // Audit log
      await auditService.logAction({
        action: 'bulk_role_assigned',
        userId: assignedBy,
        targetType: 'role',
        targetId: role._id.toString(),
        metadata: {
          roleName: data.roleName,
          success,
          failed,
        },
      });

      logger.info(`Bulk role assignment completed`, {
        roleName: data.roleName,
        success,
        failed,
        assignedBy,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return {
      success,
      failed,
      errors: [],
    };
  }

  /**
   * Remove role from user (reset to default customer role)
   */
  async removeRole(userId: string, removedBy: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found', [], ERROR_CODES.USER_NOT_FOUND);
    }

    const previousRole = user.role;
    user.role = 'customer';
    await user.save();

    // Audit log
    await auditService.logAction({
      action: 'role_removed',
      userId: removedBy,
      targetType: 'user',
      targetId: user._id.toString(),
      metadata: {
        previousRole,
        newRole: 'customer',
      },
    });

    logger.info(`Role removed from user`, {
      userId: user._id,
      removedBy,
      previousRole,
    });

    return user;
  }

  // ========================================
  // Permission Checking
  // ========================================

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const role = await Role.findOne({ name: (await User.findById(userId))?.role });
    if (!role || !role.isActive) {
      return false;
    }

    // Check direct permission
    if (role.permissions.includes(permission)) {
      return true;
    }

    // Check wildcard permission (e.g., 'booking:*' covers 'booking:read')
    const [resource, action] = permission.split(':');
    const wildcardPermission = `${resource}:*`;
    if (role.permissions.includes(wildcardPermission)) {
      return true;
    }

    // Check 'admin:all' grants all permissions
    if (role.permissions.includes('admin:all')) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get user's effective permissions based on their role
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await User.findById(userId);
    if (!user) {
      return [];
    }

    const role = await Role.findOne({ name: user.role });
    if (!role || !role.isActive) {
      return [];
    }

    return role.permissions;
  }

  /**
   * Check if user is in admin hierarchy (has elevated permissions)
   */
  async isInAdminHierarchy(userId: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    const adminRoles = ADMIN_PERMISSION_HIERARCHY.flatMap((h) => h.roles);
    return adminRoles.includes(user.role);
  }

  /**
   * Check if user can manage another user (based on hierarchy)
   */
  async canManageUser(managerId: string, targetUserId: string): Promise<boolean> {
    const [manager, targetUser] = await Promise.all([
      User.findById(managerId),
      User.findById(targetUserId),
    ]);

    if (!manager || !targetUser) {
      return false;
    }

    // Users can always manage themselves
    if (managerId === targetUserId) {
      return true;
    }

    // Find hierarchy levels
    const managerLevel = this.getHierarchyLevel(manager.role);
    const targetLevel = this.getHierarchyLevel(targetUser.role);

    // Can only manage users at lower hierarchy levels
    return managerLevel < targetLevel;
  }

  /**
   * Get hierarchy level for a role (lower = higher privilege)
   */
  private getHierarchyLevel(role: UserRole | string): number {
    const levelMap: Record<string, number> = {
      super_admin: 1,
      admin: 2,
      moderator: 3,
      support: 4,
      analyst: 5,
      provider: 6,
      customer: 7,
    };
    return levelMap[role] || 99;
  }

  // ========================================
  // Role Statistics
  // ========================================

  /**
   * Get role usage statistics
   */
  async getRoleStatistics(): Promise<
    Array<{
      role: string;
      userCount: number;
      isSystem: boolean;
      isActive: boolean;
      permissionCount: number;
    }>
  > {
    const roles = await Role.find();
    const statistics = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({ role: role.name as UserRole });
        return {
          role: role.name,
          userCount,
          isSystem: role.isSystem,
          isActive: role.isActive,
          permissionCount: role.permissions.length,
        };
      })
    );

    return statistics.sort((a, b) => b.userCount - a.userCount);
  }

  /**
   * Get permission usage statistics
   */
  async getPermissionStatistics(): Promise<
    Array<{
      permission: string;
      usageCount: number;
      assignedToRoles: string[];
    }>
  > {
    const roles = await Role.find({ isActive: true });

    const permissionStats: Record<
      string,
      { usageCount: number; assignedToRoles: string[] }
    > = {};

    for (const role of roles) {
      for (const permission of role.permissions) {
        if (!permissionStats[permission]) {
          permissionStats[permission] = { usageCount: 0, assignedToRoles: [] };
        }
        permissionStats[permission].usageCount++;
        permissionStats[permission].assignedToRoles.push(role.name);
      }
    }

    return Object.entries(permissionStats)
      .map(([permission, stats]) => ({
        permission,
        ...stats,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  // ========================================
  // Seed Default Roles
  // ========================================

  /**
   * Initialize default roles and permissions
   */
  async seedDefaults(): Promise<void> {
    // Seed default roles from permission model
    const { DEFAULT_ROLES } = await import('../models/permission.model');
    for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
      await Role.findOneAndUpdate(
        { name: role.name },
        role,
        { upsert: true, new: true }
      );
    }

    // Create additional admin hierarchy roles if they don't exist
    const adminHierarchyRoles = [
      {
        name: 'super_admin',
        description: 'Super Administrator with full system access',
        permissions: ['*'],
        isSystem: true,
        isActive: true,
      },
      {
        name: 'moderator',
        description: 'Content and user moderation role',
        permissions: [
          'booking:read:all', 'booking:update:all',
          'service:read:all', 'service:update',
          'user:read:all', 'user:update',
          'analytics:read',
          'content:read', 'content:update',
          'compliance:view',
        ],
        isSystem: false,
        isActive: true,
      },
      {
        name: 'support',
        description: 'Customer support role',
        permissions: [
          'booking:read:all', 'booking:update:all',
          'service:read:all',
          'user:read:all', 'user:update',
          'analytics:read',
          'compliance:view',
        ],
        isSystem: false,
        isActive: true,
      },
      {
        name: 'analyst',
        description: 'Data analyst role with read-only access',
        permissions: [
          'analytics:read', 'analytics:export',
          'compliance:view', 'compliance:reports',
        ],
        isSystem: false,
        isActive: true,
      },
    ];

    for (const roleData of adminHierarchyRoles) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
    }

    logger.info('RBAC defaults seeded successfully');
  }
}

// Export singleton instance
export const rbacService = new RBACService();

export default rbacService;

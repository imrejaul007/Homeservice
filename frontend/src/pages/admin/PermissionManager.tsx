
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Key,
  Lock,
  Unlock,
  Plus,
  Minus,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Download,
  Filter,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

// ============================================
// Type Definitions
// ============================================

interface Permission {
  _id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | '*';
}

interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  permissionDetails?: Permission[];
  createdAt: string;
  updatedAt: string;
}

interface RoleStats {
  role: string;
  userCount: number;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
}

interface PermissionCategory {
  label: string;
  permissions: string[];
}

interface UserWithRole {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================
// Permission Categories Configuration
// ============================================

const PERMISSION_CATEGORIES: Record<string, PermissionCategory> = {
  bookings: {
    label: 'Bookings',
    permissions: [
      'booking:create',
      'booking:read',
      'booking:read:all',
      'booking:update',
      'booking:update:all',
      'booking:delete',
    ],
  },
  services: {
    label: 'Services',
    permissions: [
      'service:create',
      'service:read',
      'service:read:all',
      'service:update',
      'service:update:all',
      'service:delete',
    ],
  },
  users: {
    label: 'Users',
    permissions: [
      'user:read',
      'user:read:all',
      'user:update',
      'user:update:all',
      'user:delete',
    ],
  },
  providers: {
    label: 'Providers',
    permissions: [
      'provider:read',
      'provider:read:all',
      'provider:approve',
      'provider:suspend',
      'provider:delete',
    ],
  },
  analytics: {
    label: 'Analytics',
    permissions: [
      'analytics:read',
      'analytics:export',
      'analytics:dashboard',
    ],
  },
  settings: {
    label: 'Settings',
    permissions: ['settings:read', 'settings:manage', 'settings:system'],
  },
  finance: {
    label: 'Finance',
    permissions: [
      'finance:read',
      'finance:manage',
      'wallet:manage',
      'payout:process',
      'commission:view',
    ],
  },
  content: {
    label: 'Content',
    permissions: [
      'content:create',
      'content:read',
      'content:update',
      'content:delete',
      'category:manage',
    ],
  },
  security: {
    label: 'Security',
    permissions: [
      'security:audit',
      'security:logs',
      'security:configure',
      'role:manage',
      'permission:assign',
    ],
  },
  compliance: {
    label: 'Compliance',
    permissions: [
      'compliance:view',
      'compliance:reports',
      'gdpr:manage',
      'consent:manage',
    ],
  },
};

// ============================================
// Helper Components
// ============================================

const StatusBadge: React.FC<{ status: boolean; activeLabel?: string; inactiveLabel?: string }> = ({
  status,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
      }`}
    >
      {status ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <XCircle className="w-3 h-3 mr-1" />
      )}
      {status ? activeLabel : inactiveLabel}
    </span>
  );
};

const SystemBadge: React.FC<{ isSystem: boolean }> = ({ isSystem }) => {
  if (!isSystem) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
      <Lock className="w-3 h-3 mr-1" />
      System
    </span>
  );
};

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-nilin-coral ${sizeClasses[size]}`} />
  );
};

// ============================================
// Permission Tree Component
// ============================================

const PermissionTree: React.FC<{
  categories: Record<string, PermissionCategory>;
  selectedPermissions: string[];
  onPermissionToggle: (permission: string) => void;
  disabled?: boolean;
}> = ({ categories, selectedPermissions, onPermissionToggle, disabled }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(categories))
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-2">
      {Object.entries(categories).map(([key, category]) => {
        const isExpanded = expandedCategories.has(key);
        const selectedCount = category.permissions.filter((p) =>
          selectedPermissions.includes(p)
        ).length;

        return (
          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(key)}
              disabled={disabled}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2 text-gray-500" />
                )}
                <Shield className="w-4 h-4 mr-2 text-gray-600" />
                <span className="font-medium text-gray-900">{category.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedCount}/{category.permissions.length}
                </span>
                {selectedCount === category.permissions.length && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 py-2 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {category.permissions.map((permission) => {
                    const isSelected = selectedPermissions.includes(permission);
                    const permissionName = permission.split(':')[1];

                    return (
                      <label
                        key={permission}
                        className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-nilin-coral/10 border border-nilin-coral/30'
                            : 'hover:bg-gray-50 border border-transparent'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onPermissionToggle(permission)}
                          disabled={disabled}
                          className="w-4 h-4 text-nilin-coral border-gray-300 rounded focus:ring-nilin-coral"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {permissionName.replace(/:all$/, ' (All)')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// Role Card Component
// ============================================

const RoleCard: React.FC<{
  role: Role;
  stats?: RoleStats;
  onEdit: (role: Role) => void;
  onDelete: (roleId: string) => void;
  onViewUsers: (roleName: string) => void;
}> = ({ role, stats, onEdit, onDelete, onViewUsers }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const systemRoles = ['admin', 'customer', 'provider', 'super_admin'];
  const canModify = !role.isSystem && !systemRoles.includes(role.name);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
              <SystemBadge isSystem={role.isSystem} />
              <StatusBadge status={role.isActive} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewUsers(role.name)}
              className="p-2 text-gray-500 hover:text-nilin-coral hover:bg-gray-100 rounded-lg transition-colors"
              title="View users with this role"
            >
              <Users className="w-4 h-4" />
            </button>
            {canModify && (
              <>
                <button
                  onClick={() => onEdit(role)}
                  className="p-2 text-gray-500 hover:text-nilin-coral hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit role"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(role._id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete role"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <div className="flex items-center">
            <Key className="w-4 h-4 mr-1" />
            <span>{role.permissions.length} permissions</span>
          </div>
          {stats && (
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span>{stats.userCount} users</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose"
        >
          {isExpanded ? 'Hide permissions' : 'Show permissions'}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                >
                  <Key className="w-3 h-3 mr-1" />
                  {permission}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Role Edit Modal
// ============================================

const RoleEditModal: React.FC<{
  role?: Role | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string; permissions: string[]; isActive: boolean }) => void;
}> = ({ role, isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description);
      setPermissions(role.permissions);
      setIsActive(role.isActive);
    } else {
      setName('');
      setDescription('');
      setPermissions([]);
      setIsActive(true);
    }
  }, [role, isOpen]);

  const handlePermissionToggle = (permission: string) => {
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSelectAll = (category: string) => {
    const categoryPermissions = PERMISSION_CATEGORIES[category]?.permissions || [];
    const allSelected = categoryPermissions.every((p) => permissions.includes(p));

    if (allSelected) {
      setPermissions((prev) => prev.filter((p) => !categoryPermissions.includes(p)));
    } else {
      setPermissions((prev) => [...new Set([...prev, ...categoryPermissions])]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ name, description, permissions, isActive });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {role ? 'Edit Role' : 'Create New Role'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!role}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent disabled:bg-gray-50"
                  placeholder="e.g., content_manager"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  placeholder="Describe the purpose of this role..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-nilin-coral border-gray-300 rounded focus:ring-nilin-coral"
                  />
                  <span className="ml-2 text-sm text-gray-700">Role is active</span>
                </label>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions
                </label>
                <div className="flex gap-2">
                  {Object.keys(PERMISSION_CATEGORIES).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleSelectAll(category)}
                      className="px-2 py-1 text-xs text-nilin-coral hover:bg-nilin-coral/10 rounded"
                    >
                      Select all {PERMISSION_CATEGORIES[category].label}
                    </button>
                  ))}
                </div>
              </div>

              <PermissionTree
                categories={PERMISSION_CATEGORIES}
                selectedPermissions={permissions}
                onPermissionToggle={handlePermissionToggle}
              />
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50"
                >
                  {isSaving ? (
                    <LoadingSpinner size="sm" />
                  ) : role ? (
                    'Save Changes'
                  ) : (
                    'Create Role'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// User List Modal
// ============================================

const UserListModal: React.FC<{
  roleName: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ roleName, isOpen, onClose }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, roleName]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { role: roleName, limit: 50 },
      });
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(search.toLowerCase()) ||
      user.lastName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Users with Role</h2>
              <p className="text-sm text-gray-500 mt-1">Role: {roleName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No users found with this role.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <div key={user._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={user.isActive} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Permission Manager Component
// ============================================

const PermissionManager: React.FC = () => {
  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [selectedRoleName, setSelectedRoleName] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterSystem, setFilterSystem] = useState<'all' | 'system' | 'custom'>('all');

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesResponse, statsResponse] = await Promise.all([
        api.get('/admin/rbac/roles'),
        api.get('/admin/rbac/roles/stats'),
      ]);

      setRoles(rolesResponse.data.data.roles || []);
      setRoleStats(statsResponse.data.data.stats || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('Failed to load roles. Please try again.');
      // Use mock data for demo
      setRoles(getMockRoles());
      setRoleStats(getMockRoleStats());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Filter roles
  const filteredRoles = roles.filter((role) => {
    // Search filter
    if (
      searchQuery &&
      !role.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !role.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    if (filterStatus === 'active' && !role.isActive) return false;
    if (filterStatus === 'inactive' && role.isActive) return false;

    // System filter
    if (filterSystem === 'system' && !role.isSystem) return false;
    if (filterSystem === 'custom' && role.isSystem) return false;

    return true;
  });

  // Get stats for a role
  const getStatsForRole = (roleName: string): RoleStats | undefined => {
    return roleStats.find((s) => s.role === roleName);
  };

  // Handlers
  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsEditModalOpen(true);
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setIsEditModalOpen(true);
  };

  const handleSaveRole = async (data: {
    name: string;
    description: string;
    permissions: string[];
    isActive: boolean;
  }) => {
    try {
      if (editingRole) {
        await api.patch(`/admin/rbac/roles/${editingRole._id}`, data);
      } else {
        await api.post('/admin/rbac/roles', data);
      }
      fetchRoles();
    } catch (err) {
      console.error('Failed to save role:', err);
      throw err;
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await api.delete(`/admin/rbac/roles/${roleId}`);
      fetchRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
      toast.error('Failed to delete role. It may be in use by users.');
    }
  };

  const handleViewUsers = (roleName: string) => {
    setSelectedRoleName(roleName);
    setIsUserListOpen(true);
  };

  const handleExportRoles = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      roles: roles.map((role) => ({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        isActive: role.isActive,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roles-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permission Manager</h1>
            <p className="text-gray-500 mt-1">
              Manage roles, permissions, and access control
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportRoles}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={handleCreateRole}
              className="flex items-center px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Roles</p>
                <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Active Roles</p>
                <p className="text-2xl font-bold text-gray-900">
                  {roles.filter((r) => r.isActive).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">System Roles</p>
                <p className="text-2xl font-bold text-gray-900">
                  {roles.filter((r) => r.isSystem).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {roleStats.reduce((sum, s) => sum + s.userCount, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <label className="text-sm text-gray-500 mr-2">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center">
                <label className="text-sm text-gray-500 mr-2">Type:</label>
                <select
                  value={filterSystem}
                  onChange={(e) => setFilterSystem(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="all">All</option>
                  <option value="system">System</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <button
                onClick={fetchRoles}
                className="p-2 text-gray-500 hover:text-nilin-coral hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Role List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchRoles}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No roles found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRoles.map((role) => (
              <RoleCard
                key={role._id}
                role={role}
                stats={getStatsForRole(role.name)}
                onEdit={handleEditRole}
                onDelete={handleDeleteRole}
                onViewUsers={handleViewUsers}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <RoleEditModal
        role={editingRole}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRole(null);
        }}
        onSave={handleSaveRole}
      />

      {/* User List Modal */}
      <UserListModal
        roleName={selectedRoleName}
        isOpen={isUserListOpen}
        onClose={() => setIsUserListOpen(false)}
      />
    </div>
  );
};

// ============================================
// Mock Data for Demo
// ============================================

function getMockRoles(): Role[] {
  return [
    {
      _id: '1',
      name: 'admin',
      description: 'Full administrative access to the platform',
      permissions: ['*'],
      isSystem: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '2',
      name: 'customer',
      description: 'Regular customer role',
      permissions: [
        'booking:create',
        'booking:read',
        'booking:update',
        'service:read',
        'user:read',
        'user:update',
      ],
      isSystem: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '3',
      name: 'provider',
      description: 'Service provider role',
      permissions: [
        'booking:read',
        'booking:update',
        'service:create',
        'service:read',
        'service:update',
        'service:delete',
        'user:read',
        'user:update',
        'analytics:read',
      ],
      isSystem: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '4',
      name: 'moderator',
      description: 'Content and user moderation role',
      permissions: [
        'booking:read:all',
        'booking:update:all',
        'service:read:all',
        'service:update',
        'user:read:all',
        'user:update',
        'analytics:read',
        'content:read',
        'content:update',
        'compliance:view',
      ],
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '5',
      name: 'support',
      description: 'Customer support role',
      permissions: [
        'booking:read:all',
        'booking:update:all',
        'service:read:all',
        'user:read:all',
        'user:update',
        'analytics:read',
        'compliance:view',
      ],
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: '6',
      name: 'analyst',
      description: 'Data analyst role with read-only access',
      permissions: [
        'analytics:read',
        'analytics:export',
        'compliance:view',
        'compliance:reports',
      ],
      isSystem: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function getMockRoleStats(): RoleStats[] {
  return [
    { role: 'admin', userCount: 3, isSystem: true, isActive: true, permissionCount: 1 },
    { role: 'customer', userCount: 1250, isSystem: true, isActive: true, permissionCount: 6 },
    { role: 'provider', userCount: 87, isSystem: true, isActive: true, permissionCount: 9 },
    { role: 'moderator', userCount: 5, isSystem: false, isActive: true, permissionCount: 10 },
    { role: 'support', userCount: 8, isSystem: false, isActive: true, permissionCount: 7 },
    { role: 'analyst', userCount: 2, isSystem: false, isActive: true, permissionCount: 4 },
  ];
}

export default PermissionManager;

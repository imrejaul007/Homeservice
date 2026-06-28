
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { useAuthStore } from '@/stores/authStore';
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
// Confirm Modal Component
// ============================================

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'bg-nilin-rose hover:bg-nilin-rose/90 text-white',
      icon: 'text-nilin-rose',
      bg: 'bg-nilin-rose/5',
    },
    warning: {
      button: 'bg-nilin-amber hover:bg-nilin-amber/90 text-white',
      icon: 'text-nilin-amber',
      bg: 'bg-nilin-amber/5',
    },
    info: {
      button: 'bg-nilin-coral hover:bg-nilin-coral/90 text-white',
      icon: 'text-nilin-coral',
      bg: 'bg-nilin-coral/5',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-nilin-charcoal/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className={`p-6 ${styles.bg}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white">
              <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-lg font-semibold text-nilin-charcoal">{title}</h3>
              <p className="text-sm text-nilin-warmGray mt-1">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-nilin-blush/30 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-blush/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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
          ? 'bg-nilin-mint/20 text-nilin-mint'
          : 'bg-nilin-warmGray/20 text-nilin-warmGray'
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
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-nilin-violet/20 text-nilin-violet">
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
          <div key={key} className="border border-nilin-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(key)}
              disabled={disabled}
              className="w-full flex items-center justify-between px-4 py-3 bg-nilin-blush/30 hover:bg-nilin-blush/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-inset"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-nilin-warmGray" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2 text-nilin-warmGray" />
                )}
                <Shield className="w-4 h-4 mr-2 text-nilin-coral" />
                <span className="font-medium text-nilin-charcoal">{category.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-nilin-warmGray">
                  {selectedCount}/{category.permissions.length}
                </span>
                {selectedCount === category.permissions.length && (
                  <Check className="w-4 h-4 text-nilin-mint" />
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
                            : 'hover:bg-nilin-blush/30 border border-transparent'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onPermissionToggle(permission)}
                          disabled={disabled}
                          className="w-4 h-4 text-nilin-coral border-nilin-border rounded focus:ring-nilin-coral focus:ring-offset-2"
                        />
                        <span className="ml-2 text-sm text-nilin-charcoal capitalize">
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

  const canModify = false;

  return (
    <div className="bg-white rounded-xl border border-nilin-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-nilin-charcoal">{role.name}</h3>
              <SystemBadge isSystem={role.isSystem} />
              <StatusBadge status={role.isActive} />
            </div>
            <p className="text-sm text-nilin-warmGray mt-1">{role.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewUsers(role.name)}
              className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              title="View users with this role"
              aria-label="View users with this role"
            >
              <Users className="w-4 h-4" />
            </button>
            {canModify && (
              <>
                <button
                  onClick={() => onEdit(role)}
                  className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  title="Edit role"
                  aria-label="Edit role"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(role._id)}
                  className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-rose hover:bg-nilin-rose/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose focus-visible:ring-offset-2"
                  title="Delete role"
                  aria-label="Delete role"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-nilin-warmGray">
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
          className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-lg py-1"
        >
          {isExpanded ? 'Hide permissions' : 'Show permissions'}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-nilin-border/50">
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-nilin-blush/50 text-nilin-charcoal"
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
    <div className="fixed inset-0 bg-nilin-charcoal/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
        <div className="p-6 border-b border-nilin-border">
          <div className="flex items-center justify-between">
            <h2 id="role-modal-title" className="text-xl font-semibold text-nilin-charcoal">
              {role ? 'Edit Role' : 'Create New Role'}
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              aria-label="Close modal"
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
                <label htmlFor="role-name" className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!role}
                  required
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent disabled:bg-nilin-blush/30"
                  placeholder="e.g., content_manager"
                />
              </div>

              <div>
                <label htmlFor="role-description" className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Description
                </label>
                <textarea
                  id="role-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  placeholder="Describe the purpose of this role..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="role-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-nilin-coral border-nilin-border rounded focus:ring-nilin-coral focus:ring-offset-2"
                  />
                  <span className="ml-2 text-sm text-nilin-charcoal">Role is active</span>
                </label>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="block text-sm font-medium text-nilin-charcoal">
                  Permissions
                </span>
                <div className="flex gap-2">
                  {Object.keys(PERMISSION_CATEGORIES).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleSelectAll(category)}
                      className="px-2 py-1 text-xs text-nilin-coral hover:bg-nilin-coral/10 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
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

          <div className="p-6 border-t border-nilin-border bg-nilin-blush/30">
            <div className="flex items-center justify-between">
              <div className="text-sm text-nilin-warmGray">
                {permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-blush/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
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
    <div className="fixed inset-0 bg-nilin-charcoal/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="users-modal-title">
        <div className="p-6 border-b border-nilin-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="users-modal-title" className="text-xl font-semibold text-nilin-charcoal">Users with Role</h2>
              <p className="text-sm text-nilin-warmGray mt-1">Role: {roleName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-nilin-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-nilin-warmGray">
              <Users className="w-12 h-12 mx-auto mb-4 text-nilin-border" />
              <p>No users found with this role.</p>
            </div>
          ) : (
            <div className="divide-y divide-nilin-border/30">
              {filteredUsers.map((user) => (
                <div key={user._id} className="p-4 hover:bg-nilin-blush/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                        <span className="text-sm font-medium text-nilin-charcoal">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-nilin-charcoal">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-nilin-warmGray">{user.email}</p>
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
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Permission guard - redirect non-admins to unauthorized page
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; roleId: string | null }>({
    isOpen: false,
    roleId: null,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterSystem, setFilterSystem] = useState<'all' | 'system' | 'custom'>('all');

  // Fetch roles (read-only — system roles from GET /admin/rbac/roles)
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesResponse, statsResponse] = await Promise.all([
        api.get('/admin/rbac/roles'),
        api.get('/admin/rbac/roles/stats').catch(() => ({ data: { data: { stats: [] } } })),
      ]);

      const apiRoles = rolesResponse.data.data.roles || [];
      setRoles(
        apiRoles.map((role: { name: string; permissions: string[] }) => ({
          _id: role.name,
          name: role.name,
          description: `System role with ${role.permissions.length} permissions`,
          permissions: role.permissions,
          isSystem: true,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        }))
      );
      setRoleStats(statsResponse.data.data.stats || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('Failed to load roles. Please try again.');
      setRoles([]);
      setRoleStats([]);
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
    setDeleteConfirm({ isOpen: true, roleId });
  };

  const confirmDeleteRole = async () => {
    if (!deleteConfirm.roleId) return;

    try {
      await api.delete(`/admin/rbac/roles/${deleteConfirm.roleId}`);
      toast.success('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
      toast.error('Failed to delete role. It may be in use by users.');
    } finally {
      setDeleteConfirm({ isOpen: false, roleId: null });
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
    <ErrorBoundary>
      <AdminPageShell
        title="Permission Manager"
        subtitle="View system roles and permissions (read-only)"
        wideLayout
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <main id="main-content" className="space-y-6">
          {/* Screen reader status announcer */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {isLoading && 'Loading roles...'}
            {error && `Error: ${error}`}
            {!isLoading && !error && filteredRoles.length > 0 && `Showing ${filteredRoles.length} roles`}
            {!isLoading && !error && filteredRoles.length === 0 && 'No roles found'}
          </div>

          {/* Read-only notice */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Roles are static and defined in the backend RBAC configuration. Create, edit, and delete are disabled in this viewer.
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-nilin-coral/10 rounded-xl">
                <Shield className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-nilin-charcoal">Permission Manager</h1>
                <p className="text-nilin-warmGray mt-0.5">
                  View system roles and permissions (read-only)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportRoles}
                className="flex items-center px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-lg hover:bg-nilin-blush/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-nilin-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-nilin-coral/10 rounded-lg">
                  <Shield className="w-5 h-5 text-nilin-coral" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Total Roles</p>
                  <p className="text-xl font-bold text-nilin-charcoal">{roles.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-nilin-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-nilin-mint/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-nilin-mint" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Active Roles</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {roles.filter((r) => r.isActive).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-nilin-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-nilin-violet/10 rounded-lg">
                  <Lock className="w-5 h-5 text-nilin-violet" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">System Roles</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {roles.filter((r) => r.isSystem).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-nilin-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-nilin-amber/10 rounded-lg">
                  <Users className="w-5 h-5 text-nilin-amber" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Total Users</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {roleStats.reduce((sum, s) => sum + s.userCount, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-nilin-border p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 relative">
                <label htmlFor="search-roles" className="sr-only">Search roles</label>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="text"
                  id="search-roles"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roles..."
                  className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <label htmlFor="filter-status" className="text-sm text-nilin-warmGray mr-2">Status:</label>
                  <select
                    id="filter-status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label htmlFor="filter-system" className="text-sm text-nilin-warmGray mr-2">Type:</label>
                  <select
                    id="filter-system"
                    value={filterSystem}
                    onChange={(e) => setFilterSystem(e.target.value as any)}
                    className="px-3 py-2 border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  >
                    <option value="all">All</option>
                    <option value="system">System</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <button
                  onClick={fetchRoles}
                  className="w-10 h-10 flex items-center justify-center text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  title="Refresh"
                  aria-label="Refresh roles"
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
            <div className="bg-nilin-rose/5 border border-nilin-rose/20 rounded-xl p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-nilin-rose mx-auto mb-4" />
              <p className="text-nilin-rose">{error}</p>
              <button
                onClick={fetchRoles}
                className="mt-4 px-4 py-2 bg-nilin-rose text-white rounded-lg hover:bg-nilin-rose/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose focus-visible:ring-offset-2"
              >
                Try Again
              </button>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="bg-white rounded-xl border border-nilin-border p-12 text-center">
              <Shield className="w-12 h-12 text-nilin-border mx-auto mb-4" />
              <p className="text-nilin-warmGray">No roles found matching your filters.</p>
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
        </main>

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

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          title="Delete Role"
          message="Are you sure you want to delete this role? This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={confirmDeleteRole}
          onCancel={() => setDeleteConfirm({ isOpen: false, roleId: null })}
        />
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default PermissionManager;

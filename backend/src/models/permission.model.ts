import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | '*';
  conditions?: Record<string, unknown>;
  createdAt: Date;
}

export interface IRole extends Document {
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  resource: { type: String, required: true, index: true },
  action: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', '*'],
    required: true,
  },
  conditions: { type: Schema.Types.Mixed },
}, { timestamps: true });

const roleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  permissions: [{ type: String }],
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes
roleSchema.index({ permissions: 1 });

export const PERMISSIONS = {
  // Bookings
  'booking:create': 'Create bookings',
  'booking:read': 'Read own bookings',
  'booking:read:all': 'Read all bookings',
  'booking:update': 'Update own bookings',
  'booking:update:all': 'Update all bookings',
  'booking:delete': 'Delete bookings',
  // Services
  'service:create': 'Create services',
  'service:read': 'Read own services',
  'service:read:all': 'Read all services',
  'service:update': 'Update own services',
  'service:update:all': 'Update all services',
  'service:delete': 'Delete services',
  // Users
  'user:read': 'Read own profile',
  'user:read:all': 'Read all users',
  'user:update': 'Update own profile',
  'user:update:all': 'Update all users',
  'user:delete': 'Delete users',
  // Admin
  'admin:all': 'Full admin access',
  'analytics:read': 'Read analytics',
  'analytics:export': 'Export analytics',
  'settings:manage': 'Manage settings',
  'provider:approve': 'Approve providers',
  'coupon:manage': 'Manage coupons',
  'wallet:manage': 'Manage wallets',
  'subscription:manage': 'Manage subscriptions',
} as const;

export const DEFAULT_ROLES = {
  customer: {
    name: 'customer',
    description: 'Regular customer role',
    permissions: [
      'booking:create', 'booking:read', 'booking:update',
      'service:read',
      'user:read', 'user:update',
    ],
  },
  provider: {
    name: 'provider',
    description: 'Service provider role',
    permissions: [
      'booking:read', 'booking:update',
      'service:create', 'service:read', 'service:update', 'service:delete',
      'user:read', 'user:update',
      'analytics:read',
    ],
  },
  admin: {
    name: 'admin',
    description: 'Administrator role',
    permissions: Object.keys(PERMISSIONS),
    isSystem: true,
  },
};

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
export const Role = mongoose.model<IRole>('Role', roleSchema);

// Seed default roles
export const seedRoles = async () => {
  for (const [_key, role] of Object.entries(DEFAULT_ROLES)) {
    await Role.findOneAndUpdate(
      { name: role.name },
      role,
      { upsert: true, new: true }
    );
  }
  console.log('Roles seeded');
};

export default { Permission, Role, seedRoles, PERMISSIONS, DEFAULT_ROLES };

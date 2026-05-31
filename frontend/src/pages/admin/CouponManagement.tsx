import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { formatPrice } from '../../utils/currency';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';

interface Coupon {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  maxUses: number;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  title: string;
  description?: string;
  featured?: boolean;
  createdAt: string;
}

interface CouponStats {
  total: number;
  active: number;
  inactive: number;
  totalUses: number;
  byType: {
    percentage: number;
    fixed: number;
    free_service: number;
  };
  featured: number;
}

interface CouponFormData {
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount: number;
  minOrderAmount: number;
  usageLimit: number;
  validFrom: string;
  validUntil: string;
  title: string;
  description: string;
  featured: boolean;
}

interface ValidationErrors {
  code?: string;
  title?: string;
  value?: string;
  minOrderAmount?: string;
  usageLimit?: string;
  validFrom?: string;
  validUntil?: string;
  general?: string;
}

const validateCoupon = (data: CouponFormData, isEditing: boolean): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Code validation (not editable, so only check if creating)
  if (!isEditing) {
    if (!data.code || data.code.trim().length === 0) {
      errors.code = 'Coupon code is required';
    } else if (data.code.trim().length < 3) {
      errors.code = 'Code must be at least 3 characters';
    } else if (!/^[A-Za-z0-9]+$/.test(data.code)) {
      errors.code = 'Code must be alphanumeric (letters and numbers only)';
    }
  }

  // Title validation
  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  } else if (data.title.trim().length < 2) {
    errors.title = 'Title must be at least 2 characters';
  }

  // Value validation
  if (data.value < 0) {
    errors.value = 'Value cannot be negative';
  } else if (data.type === 'percentage' && data.value > 100) {
    errors.value = 'Percentage discount cannot exceed 100%';
  }

  // Min order amount validation
  if (data.minOrderAmount < 0) {
    errors.minOrderAmount = 'Minimum order amount cannot be negative';
  }

  // Usage limit validation
  if (data.usageLimit < 1) {
    errors.usageLimit = 'Usage limit must be at least 1';
  }

  // Date validations
  if (!data.validFrom) {
    errors.validFrom = 'Valid from date is required';
  }

  if (!data.validUntil) {
    errors.validUntil = 'Expiration date is required';
  } else {
    const validUntilDate = new Date(data.validUntil);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (validUntilDate < now) {
      errors.validUntil = 'Expiration date must be in the future';
    }

    if (data.validFrom && new Date(data.validFrom) >= validUntilDate) {
      errors.validUntil = 'Expiration must be after start date';
    }
  }

  return errors;
};

const CouponManagement: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'free_service',
    value: 10,
    maxDiscount: 0,
    minOrderAmount: 0,
    usageLimit: 100,
    validFrom: '',
    validUntil: '',
    title: '',
    description: '',
    featured: false,
  });

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (filterType) params.append('type', filterType);
      if (filterActive) params.append('isActive', filterActive);

      const response = await api.get(`/admin/coupons?${params}`);
      const data = response.data?.data;
      setCoupons(data?.coupons ?? []);
      setTotalPages(data?.pagination?.pages ?? 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/coupons/stats');
      setStats(response.data?.data?.stats ?? null);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchStats();
  }, [currentPage, search, filterType, filterActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const errors = validateCoupon(formData, !!editingCoupon);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        usageLimit: formData.usageLimit,
        minOrderAmount: formData.minOrderAmount,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString(),
      };

      if (editingCoupon) {
        await api.put(`/admin/coupons/${editingCoupon._id}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }

      setShowModal(false);
      setEditingCoupon(null);
      setValidationErrors({});
      resetForm();
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setValidationErrors({});
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscount: coupon.maxDiscount || 0,
      minOrderAmount: coupon.minOrderValue,
      usageLimit: coupon.maxUses,
      validFrom: coupon.validFrom?.split('T')[0] || '',
      validUntil: coupon.validUntil?.split('T')[0] || '',
      title: coupon.title,
      description: coupon.description || '',
      featured: coupon.featured || false,
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this coupon?')) return;
    try {
      await api.post(`/admin/coupons/${id}/deactivate`);
      toast.success('Coupon deactivated successfully');
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate coupon');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon deleted successfully');
      fetchCoupons();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete coupon');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: 10,
      maxDiscount: 0,
      minOrderAmount: 0,
      usageLimit: 100,
      validFrom: '',
      validUntil: '',
      title: '',
      description: '',
      featured: false,
    });
    setValidationErrors({});
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'percentage': return 'bg-blue-100 text-blue-800';
      case 'fixed': return 'bg-green-100 text-green-800';
      case 'free_service': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Coupon Management"
        subtitle="Create and manage discount codes"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Coupons', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => { resetForm(); setEditingCoupon(null); setShowModal(true); }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans"
          >
            Create Coupon
          </button>
        }
      >
      <div className="space-y-6">

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Coupons</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Uses</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalUses}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Featured</p>
              <p className="text-2xl font-bold text-purple-600">{stats.featured}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search coupons..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Types</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
              <option value="free_service">Free Service</option>
            </select>
            <select
              value={filterActive}
              onChange={(e) => { setFilterActive(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Coupons Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No coupons found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {coupons.map((coupon) => (
                  <tr key={coupon._id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{coupon.code}</div>
                      <div className="text-sm text-gray-500">{coupon.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(coupon.type)}`}>
                        {coupon.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {coupon.type === 'percentage'
                        ? `${coupon.value}%${coupon.maxDiscount ? ` (max ${formatPrice(coupon.maxDiscount)})` : ''}`
                        : formatPrice(coupon.value)}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {coupon.currentUses} / {coupon.maxUses}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {new Date(coupon.validUntil).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {coupon.featured && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        {coupon.isActive ? (
                          <button
                            onClick={() => handleDeactivate(coupon._id)}
                            className="text-yellow-600 hover:text-yellow-800 text-sm"
                          >
                            Deactivate
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleDelete(coupon._id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {validationErrors.general && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                  {validationErrors.general}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Coupon Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value.toUpperCase() });
                    setValidationErrors(prev => ({ ...prev, code: undefined }));
                  }}
                  className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.code ? 'border-red-500' : ''}`}
                  required
                  disabled={!!editingCoupon}
                  placeholder="e.g., SAVE20"
                />
                {validationErrors.code && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.code}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    setValidationErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.title ? 'border-red-500' : ''}`}
                  required
                  placeholder="e.g., Summer Sale 20% Off"
                />
                {validationErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' | 'free_service' })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_service">Free Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {formData.type === 'percentage' ? 'Percentage (%)' : 'Amount'}
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => {
                      setFormData({ ...formData, value: Number(e.target.value) });
                      setValidationErrors(prev => ({ ...prev, value: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.value ? 'border-red-500' : ''}`}
                    required
                    min="0"
                  />
                  {validationErrors.value && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.value}</p>
                  )}
                </div>
              </div>
              {formData.type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Discount</label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    min="0"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Order Amount</label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => {
                      setFormData({ ...formData, minOrderAmount: Number(e.target.value) });
                      setValidationErrors(prev => ({ ...prev, minOrderAmount: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.minOrderAmount ? 'border-red-500' : ''}`}
                    min="0"
                  />
                  {validationErrors.minOrderAmount && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.minOrderAmount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => {
                      setFormData({ ...formData, usageLimit: Number(e.target.value) });
                      setValidationErrors(prev => ({ ...prev, usageLimit: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.usageLimit ? 'border-red-500' : ''}`}
                    min="1"
                  />
                  {validationErrors.usageLimit && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.usageLimit}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => {
                      setFormData({ ...formData, validFrom: e.target.value });
                      setValidationErrors(prev => ({ ...prev, validFrom: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.validFrom ? 'border-red-500' : ''}`}
                    required
                  />
                  {validationErrors.validFrom && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.validFrom}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => {
                      setFormData({ ...formData, validUntil: e.target.value });
                      setValidationErrors(prev => ({ ...prev, validUntil: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.validUntil ? 'border-red-500' : ''}`}
                    required
                  />
                  {validationErrors.validUntil && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.validUntil}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
                  Featured on Homepage
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingCoupon ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default CouponManagement;

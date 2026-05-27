import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface ApiKey {
  _id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  rateLimit: number;
  createdBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

interface ApiKeyStats {
  total: number;
  active: number;
  inactive: number;
  expiringSoon: number;
}

interface ApiKeyFormData {
  name: string;
  description: string;
  permissions: string[];
  expiresAt: string;
  rateLimit: number;
}

interface ValidationErrors {
  name?: string;
  permissions?: string;
  expiresAt?: string;
  rateLimit?: string;
}

const validateApiKey = (data: ApiKeyFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  // Permissions validation
  if (data.permissions.length === 0) {
    errors.permissions = 'At least one permission is required';
  }

  // Rate limit validation
  if (data.rateLimit < 1) {
    errors.rateLimit = 'Rate limit must be at least 1';
  } else if (data.rateLimit > 10000) {
    errors.rateLimit = 'Rate limit cannot exceed 10000';
  }

  // Expiration date validation (if provided)
  if (data.expiresAt) {
    const expiresDate = new Date(data.expiresAt);
    const now = new Date();
    if (expiresDate <= now) {
      errors.expiresAt = 'Expiration date must be in the future';
    }
  }

  return errors;
};

const ApiKeyManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    expiresAt: '',
    rateLimit: 100,
  });

  const availablePermissions = [
    { value: 'read', label: 'Read' },
    { value: 'write', label: 'Write' },
    { value: 'delete', label: 'Delete' },
    { value: 'admin', label: 'Admin' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'webhooks', label: 'Webhooks' },
    { value: 'broadcast', label: 'Broadcast' },
    { value: 'coupons', label: 'Coupons' },
  ];

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (filterActive) params.append('isActive', filterActive);

      const response = await api.get(`/admin/api-keys?${params}`);
      setApiKeys(response.data.data.apiKeys);
      setTotalPages(response.data.data.pagination.pages);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/api-keys/stats');
      setStats(response.data.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchStats();
  }, [currentPage, search, filterActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const errors = validateApiKey(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const payload = {
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      };

      const response = await api.post('/admin/api-keys', payload);
      setCreatedKey(response.data.data.key);
      setShowKeyModal(true);
      setShowModal(false);
      setValidationErrors({});
      resetForm();
      fetchApiKeys();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create API key');
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) return;
    try {
      const response = await api.post(`/admin/api-keys/${id}/regenerate`);
      setCreatedKey(response.data.data.key);
      setShowKeyModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to regenerate API key');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.post(`/admin/api-keys/${id}/toggle`);
      fetchApiKeys();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle API key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/api-keys/${id}`);
      toast.success('API key deleted successfully');
      fetchApiKeys();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete API key');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
      expiresAt: '',
      rateLimit: 100,
    });
    setValidationErrors({});
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">API Key Management</h1>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create API Key
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Keys</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Inactive</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search API keys..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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

        {/* API Keys Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No API keys found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key Prefix</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {apiKeys.map((key) => (
                  <tr key={key._id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{key.name}</div>
                      {key.description && (
                        <div className="text-sm text-gray-500">{key.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">{key.keyPrefix}...</code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {key.rateLimit}/min
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRegenerate(key._id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={() => handleToggle(key._id)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm"
                        >
                          {key.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(key._id)}
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create API Key</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setValidationErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.name ? 'border-red-500' : ''}`}
                  required
                  placeholder="e.g., Production API Key"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Optional description for this API key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions *</label>
                <div className="grid grid-cols-2 gap-2">
                  {availablePermissions.map((perm) => (
                    <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={() => {
                          togglePermission(perm.value);
                          setValidationErrors(prev => ({ ...prev, permissions: undefined }));
                        }}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
                {validationErrors.permissions && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.permissions}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expires At</label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => {
                      setFormData({ ...formData, expiresAt: e.target.value });
                      setValidationErrors(prev => ({ ...prev, expiresAt: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.expiresAt ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.expiresAt && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.expiresAt}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rate Limit (per min)</label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => {
                      setFormData({ ...formData, rateLimit: Number(e.target.value) });
                      setValidationErrors(prev => ({ ...prev, rateLimit: undefined }));
                    }}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg ${validationErrors.rateLimit ? 'border-red-500' : ''}`}
                    min="1"
                    max="10000"
                  />
                  {validationErrors.rateLimit && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.rateLimit}</p>
                  )}
                </div>
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
                  disabled={formData.permissions.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key Display Modal */}
      {showKeyModal && createdKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">API Key Created</h2>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Copy this API key now. You won't be able to see it again.
              </p>
            </div>
            <div className="flex gap-2 mb-4">
              <code className="flex-1 bg-gray-100 p-3 rounded text-sm break-all">{createdKey}</code>
              <button
                onClick={() => copyToClipboard(createdKey)}
                className="px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setShowKeyModal(false); setCreatedKey(null); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;

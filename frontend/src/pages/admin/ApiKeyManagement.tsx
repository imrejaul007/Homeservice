import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Key,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Copy,
  Trash2,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  X,
  Save,
  Info,
  Link2,
  Shield,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '../../lib/utils';
import {
  adminApiKeyApi,
  API_KEY_PERMISSIONS,
  type AdminApiKeyRecord,
  type ApiKeyFormPayload,
  type ApiKeyStats,
} from '../../services/adminApiKeyApi';

const emptyForm = (): ApiKeyFormPayload => ({
  name: '',
  description: '',
  permissions: ['read'],
  expiresAt: '',
  rateLimit: 100,
});

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

function formatExpiryLabel(key: AdminApiKeyRecord): string {
  if (!key.expiresAt) return 'Never';
  const exp = new Date(key.expiresAt);
  if (key.isExpired) return `Expired ${exp.toLocaleDateString('en-AE')}`;
  const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
  if (days <= 7) return `${days}d left`;
  return exp.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ApiKeyManagement: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [apiKeys, setApiKeys] = useState<AdminApiKeyRecord[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [keyModalTitle, setKeyModalTitle] = useState('API key created');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ApiKeyFormPayload>(emptyForm());
  const [confirm, setConfirm] = useState<{
    type: 'regenerate' | 'delete' | 'bulkDelete';
    id: string;
    name: string;
  } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkActionId, setBulkActionId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [list, statsRes] = await Promise.all([
          adminApiKeyApi.list({
            page,
            limit: 20,
            search: search || undefined,
            isActive: filterActive || undefined,
          }),
          adminApiKeyApi.stats(),
        ]);
        setApiKeys(list.apiKeys);
        setTotalPages(list.pagination.pages || 1);
        setStats(statsRes);
        if (isRefresh) toast.success('API keys refreshed');
      } catch (err) {
        toast.error(extractError(err) || 'Failed to load API keys');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, filterActive]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setFormData(emptyForm());
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (formData.permissions.length === 0) {
      toast.error('Select at least one permission');
      return;
    }
    setSaving(true);
    try {
      const result = await adminApiKeyApi.create(formData);
      setPlainKey(result.key);
      setKeyModalTitle('API key created');
      setShowKeyModal(true);
      setShowModal(false);
      toast.success('API key created');
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setActionId(confirm.id);
    try {
      if (confirm.type === 'regenerate') {
        const result = await adminApiKeyApi.regenerate(confirm.id);
        setPlainKey(result.key);
        setKeyModalTitle('API key regenerated');
        setShowKeyModal(true);
        toast.success('Key regenerated — update your integration');
      } else {
        await adminApiKeyApi.delete(confirm.id);
        toast.success('API key deleted');
      }
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || `Failed to ${confirm.type} key`);
    } finally {
      setActionId(null);
      setConfirm(null);
    }
  };

  const handleToggle = async (key: AdminApiKeyRecord) => {
    setActionId(key._id);
    try {
      await adminApiKeyApi.toggle(key._id);
      toast.success(key.isActive ? 'Key deactivated' : 'Key activated');
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to toggle key');
    } finally {
      setActionId(null);
    }
  };

  const copyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  const togglePermission = (perm: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleSelectKey = (id: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === apiKeys.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(apiKeys.map((k) => k._id)));
    }
  };

  const handleBulkActivate = async () => {
    if (selectedKeys.size === 0) return;
    setBulkActionId('activate');
    try {
      await Promise.all(
        [...selectedKeys].map((id) => adminApiKeyApi.toggle(id, true))
      );
      toast.success(`${selectedKeys.size} key(s) activated`);
      setSelectedKeys(new Set());
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to activate keys');
    } finally {
      setBulkActionId(null);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedKeys.size === 0) return;
    setBulkActionId('deactivate');
    try {
      await Promise.all(
        [...selectedKeys].map((id) => adminApiKeyApi.toggle(id, false))
      );
      toast.success(`${selectedKeys.size} key(s) deactivated`);
      setSelectedKeys(new Set());
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to deactivate keys');
    } finally {
      setBulkActionId(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedKeys.size === 0) return;
    const names = apiKeys
      .filter((k) => selectedKeys.has(k._id))
      .map((k) => k.name)
      .join(', ');
    setConfirm({ type: 'bulkDelete', id: [...selectedKeys].join(','), name: names });
  };

  const runBulkDelete = async () => {
    if (!confirm || confirm.type !== 'bulkDelete') return;
    setBulkActionId('delete');
    const ids = confirm.id.split(',');
    try {
      await adminApiKeyApi.bulkDelete(ids);
      toast.success(`${ids.length} key(s) deleted`);
      setSelectedKeys(new Set());
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to delete keys');
    } finally {
      setBulkActionId(null);
      setConfirm(null);
    }
  };

  return (
    <ErrorBoundary>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <AdminPageShell
        wideLayout
        title="API Key Management"
        subtitle="Create and manage integration keys for external systems"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'API Keys', current: true },
        ]}
        headerActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm hover:bg-nilin-blush/40 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button type="button" onClick={openCreate} className="btn-nilin inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create API key
            </button>
          </div>
        }
      >
        <div id="main-content" className="space-y-6">
          <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/60 px-5 py-4 flex gap-3">
            <Shield className="w-5 h-5 text-indigo-800 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-950 space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                How integrations use keys
              </p>
              <p>
                Keys are shown <strong>once</strong> at creation or regeneration. Send them as{' '}
                <code className="text-xs bg-white/80 px-1 rounded">Authorization: Bearer admin_…</code> or{' '}
                <code className="text-xs bg-white/80 px-1 rounded">X-API-Key: admin_…</code>.
                Test with <code className="text-xs bg-white/80 px-1 rounded">GET /api/integrations/v1/health</code>{' '}
                (requires <strong>read</strong> permission).
              </p>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total keys', value: stats.total },
                { label: 'Active', value: stats.active, accent: 'text-emerald-700' },
                { label: 'Inactive', value: stats.inactive, accent: 'text-red-600' },
                { label: 'Expiring soon', value: stats.expiringSoon, accent: 'text-amber-700' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5"
                >
                  <p className="text-xs uppercase tracking-wide text-nilin-warmGray">{kpi.label}</p>
                  <p className={cn('text-2xl font-serif mt-1', kpi.accent || 'text-nilin-charcoal')}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="search"
                  placeholder="Search by name or description…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm"
                />
              </div>
              <select
                value={filterActive}
                onChange={(e) => {
                  setFilterActive(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm"
              >
                <option value="">All status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="py-16 text-center text-nilin-warmGray">
                <Key className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-nilin-charcoal">No API keys yet</p>
                <p className="text-sm mt-1">Create a key to connect external integrations</p>
                <button type="button" onClick={openCreate} className="btn-nilin mt-4 inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create API key
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-nilin-border/50 bg-nilin-blush/20">
                      <th className="px-5 py-3 text-left">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/60"
                          aria-label={selectedKeys.size === apiKeys.length ? 'Deselect all' : 'Select all'}
                        >
                          <input
                            type="checkbox"
                            checked={apiKeys.length > 0 && selectedKeys.size === apiKeys.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-nilin-border accent-nilin-coral"
                            aria-label="Select all"
                          />
                        </button>
                      </th>
                      {['Name', 'Prefix', 'Permissions', 'Rate', 'Expires', 'Last used', 'Status', 'Actions'].map(
                        (h) => (
                          <th
                            key={h}
                            className={cn(
                              'px-5 py-3 text-xs font-semibold uppercase text-nilin-warmGray',
                              h === 'Actions' ? 'text-right' : 'text-left'
                            )}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nilin-border/40">
                    {apiKeys.map((key) => {
                      const busy = actionId === key._id;
                      const statusLabel = key.isExpired
                        ? 'Expired'
                        : key.isActive
                          ? 'Active'
                          : 'Inactive';
                      const statusClass = key.isExpired
                        ? 'bg-amber-100 text-amber-800'
                        : key.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600';

                      return (
                        <tr key={key._id} className="hover:bg-nilin-blush/10">
                          <td className="px-5 py-4">
                            <p className="font-medium text-nilin-charcoal">{key.name}</p>
                            {key.description && (
                              <p className="text-xs text-nilin-warmGray truncate max-w-[200px]">
                                {key.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <code className="text-xs bg-nilin-blush/40 px-2 py-1 rounded font-mono">
                              {key.keyPrefix}…
                            </code>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {key.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded text-xs bg-sky-100 text-sky-800"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-nilin-charcoal">{key.rateLimit}/min</td>
                          <td className="px-5 py-4 text-nilin-warmGray">{formatExpiryLabel(key)}</td>
                          <td className="px-5 py-4 text-nilin-warmGray">
                            {key.lastUsedAt
                              ? new Date(key.lastUsedAt).toLocaleDateString('en-AE')
                              : 'Never'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusClass)}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggle(key)}
                                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-nilin-blush/50 disabled:opacity-50"
                                title={key.isActive ? 'Deactivate' : 'Activate'}
                                aria-label={key.isActive ? 'Deactivate key' : 'Activate key'}
                              >
                                {busy ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : key.isActive ? (
                                  <ToggleRight className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({ type: 'regenerate', id: key._id, name: key.name })
                                }
                                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-sky-50"
                                title="Regenerate"
                                aria-label="Regenerate key"
                              >
                                <RotateCcw className="w-4 h-4 text-sky-700" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({ type: 'delete', id: key._id, name: key.name })
                                }
                                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-red-50"
                                title="Delete"
                                aria-label="Delete key"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-nilin-border/40 flex justify-center gap-3 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 min-h-[44px] flex items-center justify-center rounded-xl border disabled:opacity-40"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="py-2 text-nilin-warmGray">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 min-h-[44px] flex items-center justify-center rounded-xl border disabled:opacity-40"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-nilin-border/50">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-serif">Create API key</h2>
                <button type="button" onClick={() => setShowModal(false)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2" aria-label="Close modal">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4 font-sans">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    placeholder="Production CRM sync"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Permissions *</label>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {API_KEY_PERMISSIONS.map((perm) => (
                      <label
                        key={perm.value}
                        className={cn(
                          'flex gap-2 p-2 rounded-lg border cursor-pointer text-sm',
                          formData.permissions.includes(perm.value)
                            ? 'border-nilin-coral bg-nilin-blush/30'
                            : 'border-nilin-border/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.value)}
                          onChange={() => togglePermission(perm.value)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{perm.label}</span>
                          <span className="block text-xs text-nilin-warmGray">{perm.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Expires (optional)</label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rate limit / min</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={formData.rateLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, rateLimit: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-nilin-border/60"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 min-h-[44px] flex items-center justify-center rounded-xl border text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-nilin inline-flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Create key
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showKeyModal && plainKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 border border-nilin-border/50">
              <h2 className="text-lg font-serif mb-2">{keyModalTitle}</h2>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 flex gap-2 text-sm text-amber-900">
                <Info className="w-5 h-5 flex-shrink-0" />
                Copy this key now. It cannot be viewed again.
              </div>
              <div className="flex gap-2 mb-4">
                <code className="flex-1 text-xs bg-gray-100 p-3 rounded-xl break-all font-mono">{plainKey}</code>
                <button
                  type="button"
                  onClick={() => copyKey(plainKey)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-nilin-blush hover:bg-nilin-blush/80"
                  aria-label="Copy API key"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowKeyModal(false);
                  setPlainKey(null);
                }}
                className="w-full btn-nilin min-h-[44px]"
              >
                I have saved this key
              </button>
            </div>
          </div>
        )}

        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden border">
              <div
                className={cn(
                  'p-6 flex gap-3',
                  confirm.type === 'delete' ? 'bg-red-50' : 'bg-amber-50'
                )}
              >
                <AlertTriangle
                  className={cn(
                    'w-6 h-6 flex-shrink-0',
                    confirm.type === 'delete' ? 'text-red-600' : 'text-amber-600'
                  )}
                />
                <div>
                  <h3 className="font-semibold">
                    {confirm.type === 'delete' ? 'Delete API key?' : 'Regenerate API key?'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {confirm.type === 'delete'
                      ? `"${confirm.name}" will be permanently removed.`
                      : `"${confirm.name}" — the current key stops working immediately.`}
                  </p>
                </div>
              </div>
              <div className="p-4 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-lg border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!actionId}
                  onClick={runConfirm}
                  className={cn(
                    'px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-lg text-white disabled:opacity-50',
                    confirm.type === 'delete' ? 'bg-red-600' : 'bg-amber-600'
                  )}
                >
                  {actionId ? 'Working…' : confirm.type === 'delete' ? 'Delete' : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ApiKeyManagement;

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Wrench,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Save,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { cn } from '../../lib/utils';
import {
  adminMaintenanceApi,
  DURATION_PRESETS,
  type MaintenanceSettings,
} from '../../services/adminMaintenanceApi';

const DEFAULT_MESSAGE =
  'The platform is currently under maintenance. Please try again later.';

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

const MaintenanceMode: React.FC = () => {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    enabled: false,
    message: DEFAULT_MESSAGE,
    estimatedDuration: '',
  });

  const loadSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await adminMaintenanceApi.get();
      setSettings(data);
      setFormData({
        enabled: data.maintenanceMode,
        message: data.message || DEFAULT_MESSAGE,
        estimatedDuration: data.estimatedDuration || '',
      });
      if (isRefresh) toast.success('Settings refreshed');
    } catch (err) {
      toast.error(extractError(err) || 'Failed to load maintenance settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const isDirty =
    settings &&
    (formData.enabled !== settings.maintenanceMode ||
      formData.message !== (settings.message || DEFAULT_MESSAGE) ||
      formData.estimatedDuration !== (settings.estimatedDuration || ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      toast.error('Maintenance message is required');
      return;
    }
    if (formData.enabled && !confirm(
      'Enable maintenance mode? Customers and providers will be blocked from the app.'
    )) {
      return;
    }

    setSaving(true);
    try {
      await adminMaintenanceApi.update({
        enabled: formData.enabled,
        message: formData.message.trim(),
        estimatedDuration: formData.estimatedDuration.trim() || undefined,
      });
      toast.success(
        formData.enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
      );
      await loadSettings(true);
    } catch (err) {
      toast.error(extractError(err) || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (!settings) return;
    setFormData({
      enabled: settings.maintenanceMode,
      message: settings.message || DEFAULT_MESSAGE,
      estimatedDuration: settings.estimatedDuration || '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
      </div>
    );
  }

  const liveMode = settings?.maintenanceMode ?? false;
  const previewMode = formData.enabled;

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Maintenance Mode"
        subtitle="Control platform availability during maintenance windows"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Maintenance', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => loadSettings(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm hover:bg-nilin-blush/40 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        <div className="max-w-3xl space-y-6">
          <div
            className={cn(
              'rounded-2xl border p-6 flex gap-4',
              liveMode
                ? 'bg-red-50/80 border-red-200'
                : 'bg-emerald-50/80 border-emerald-200'
            )}
          >
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                liveMode ? 'bg-red-100' : 'bg-emerald-100'
              )}
            >
              {liveMode ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <h2
                className={cn(
                  'text-lg font-serif',
                  liveMode ? 'text-red-900' : 'text-emerald-900'
                )}
              >
                Platform status: {liveMode ? 'Under maintenance' : 'Operational'}
              </h2>
              <p className={cn('text-sm mt-1', liveMode ? 'text-red-700' : 'text-emerald-700')}>
                {liveMode
                  ? 'Non-admin users see the maintenance page and receive 503 on API calls.'
                  : 'All users can access the platform normally.'}
              </p>
              {settings?.updatedAt && (
                <p className="text-xs text-nilin-warmGray mt-2">
                  Last saved {new Date(settings.updatedAt).toLocaleString('en-AE')}
                  {settings.updatedByName ? ` by ${settings.updatedByName}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="font-medium text-nilin-charcoal mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-nilin-coral" />
              Configure maintenance
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-nilin-border/40">
                <div>
                  <p className="font-medium text-nilin-charcoal">Enable maintenance mode</p>
                  <p className="text-xs text-nilin-warmGray mt-0.5">
                    Blocks customers and providers; admins keep full access.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.enabled}
                  onClick={() => setFormData((f) => ({ ...f, enabled: !f.enabled }))}
                  className={cn(
                    'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
                    formData.enabled ? 'bg-red-500' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                      formData.enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {formData.enabled && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex gap-3 text-sm text-amber-900">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    Active bookings and payments may still process via webhooks. Communicate with
                    your team before enabling.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">User-facing message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  maxLength={500}
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/60 bg-white/80 text-sm"
                />
                <p className="text-xs text-nilin-warmGray mt-1">{formData.message.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Estimated duration (optional)</label>
                <input
                  type="text"
                  value={formData.estimatedDuration}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedDuration: e.target.value })
                  }
                  placeholder="e.g., 2 hours"
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/60 bg-white/80 text-sm"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, estimatedDuration: preset })}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs border transition-colors',
                        formData.estimatedDuration === preset
                          ? 'bg-nilin-coral/15 border-nilin-coral text-nilin-charcoal'
                          : 'bg-white/80 border-nilin-border/50 hover:bg-nilin-blush/30'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">User preview</p>
                <div className="rounded-xl bg-gray-100 border border-gray-200 p-6 text-center">
                  <Wrench className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-800">Service unavailable</p>
                  <p className="text-sm text-gray-600 mt-2">{formData.message || '—'}</p>
                  {formData.estimatedDuration && (
                    <p className="text-xs text-gray-500 mt-2">
                      Expected back in {formData.estimatedDuration}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-nilin-border/40">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={!isDirty || saving}
                  className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className={cn(
                    'btn-nilin inline-flex items-center gap-2 disabled:opacity-50',
                    previewMode && 'from-red-500 to-red-600'
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {formData.enabled ? 'Save & enable maintenance' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-5 flex gap-3 text-sm text-sky-950">
            <Info className="w-5 h-5 flex-shrink-0" />
            <ul className="space-y-1 list-disc list-inside">
              <li>Public status: GET /api/platform/maintenance (no auth).</li>
              <li>Non-admin API requests return HTTP 503 with your message.</li>
              <li>Admins bypass maintenance using their JWT on all routes.</li>
              <li>Auth, webhooks, and /api/admin/* stay reachable for operations.</li>
              <li>The SPA redirects users to /maintenance automatically.</li>
            </ul>
          </div>
        </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default MaintenanceMode;

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface MaintenanceSettings {
  maintenanceMode: boolean;
  message: string;
  estimatedDuration?: string;
  updatedAt?: string;
  updatedBy?: string;
}

const MaintenanceMode: React.FC = () => {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    enabled: false,
    message: 'The platform is currently under maintenance. Please try again later.',
    estimatedDuration: '',
  });
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/maintenance');
      const data = response.data.data;
      setSettings(data);
      setFormData({
        enabled: data.maintenanceMode,
        message: data.message,
        estimatedDuration: data.estimatedDuration || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      await api.put('/admin/maintenance', {
        enabled: formData.enabled,
        message: formData.message,
        estimatedDuration: formData.estimatedDuration || undefined,
      });

      setSuccessMessage(`Maintenance mode ${formData.enabled ? 'enabled' : 'disabled'} successfully.`);
      fetchSettings();

      // Auto-hide success message after 5 seconds
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update maintenance settings');
    } finally {
      setSaving(false);
    }
  };

  const quickDurationOptions = [
    { label: '15 minutes', value: '15 minutes' },
    { label: '30 minutes', value: '30 minutes' },
    { label: '1 hour', value: '1 hour' },
    { label: '2 hours', value: '2 hours' },
    { label: '4 hours', value: '4 hours' },
    { label: '8 hours', value: '8 hours' },
    { label: '24 hours', value: '24 hours' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Mode</h1>
          <p className="text-gray-600 mt-1">
            Control platform availability for users during maintenance windows.
          </p>
        </div>

        {/* Status Card */}
        <div className={`rounded-lg shadow p-6 mb-6 ${
          settings?.maintenanceMode ? 'bg-red-50 border-2 border-red-200' : 'bg-green-50 border-2 border-green-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              settings?.maintenanceMode ? 'bg-red-100' : 'bg-green-100'
            }`}>
              {settings?.maintenanceMode ? (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                settings?.maintenanceMode ? 'text-red-800' : 'text-green-800'
              }`}>
                Platform Status: {settings?.maintenanceMode ? 'Under Maintenance' : 'Operational'}
              </h2>
              <p className={`text-sm ${
                settings?.maintenanceMode ? 'text-red-600' : 'text-green-600'
              }`}>
                {settings?.maintenanceMode
                  ? 'Users cannot access the platform except admins.'
                  : 'The platform is currently available to all users.'}
              </p>
              {settings?.updatedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {new Date(settings.updatedAt).toLocaleString()}
                  {settings.updatedBy && ` by admin`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Maintenance Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configure Maintenance Mode</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-700">Enable Maintenance Mode</label>
                <p className="text-xs text-gray-500">
                  When enabled, regular users will see a maintenance page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.enabled ? 'bg-red-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Warning when enabling */}
            {formData.enabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                    <p className="text-xs text-yellow-700 mt-1">
                      Enabling maintenance mode will prevent all non-admin users from accessing the platform.
                      Make sure you have completed any necessary backups or data operations before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maintenance Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={500}
                required
                placeholder="Enter the message users will see during maintenance..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.message.length}/500 characters
              </p>
            </div>

            {/* Estimated Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Duration (Optional)
              </label>
              <input
                type="text"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2 hours, 30 minutes"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {quickDurationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, estimatedDuration: option.value })}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      formData.estimatedDuration === option.value
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Preview
              </label>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-800 mb-1">Service Unavailable</h4>
                <p className="text-sm text-gray-600">{formData.message || 'No message set'}</p>
                {formData.estimatedDuration && (
                  <p className="text-xs text-gray-500 mt-2">
                    Expected duration: {formData.estimatedDuration}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={fetchSettings}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={saving || (!formData.enabled && settings?.maintenanceMode === false)}
                className={`px-4 py-2 rounded-lg text-white ${
                  formData.enabled
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? 'Saving...' : formData.enabled ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">How it works</h4>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>When maintenance mode is enabled, regular users see a maintenance page.</li>
            <li>Admin users can still access all platform features.</li>
            <li>Health check endpoints remain accessible for monitoring.</li>
            <li>Users currently logged in will be redirected to the maintenance page.</li>
            <li>API requests from non-admin users will return 503 status.</li>
          </ul>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default MaintenanceMode;

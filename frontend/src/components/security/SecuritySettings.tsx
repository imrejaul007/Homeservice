/**
 * SecuritySettings Component
 * Configure 2FA, biometric authentication, and security preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

// Types
interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod?: 'sms' | 'email' | 'app';
  biometricEnabled: boolean;
  loginNotifications: boolean;
  newDeviceAlerts: boolean;
  newLocationAlerts: boolean;
  sessionTimeout: number; // minutes
  trustedDevicesLimit: number;
}

interface SecuritySettingsProps {
  onSettingsChanged?: (settings: SecuritySettings) => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    biometricEnabled: false,
    loginNotifications: true,
    newDeviceAlerts: true,
    newLocationAlerts: true,
    sessionTimeout: 30,
    trustedDevicesLimit: 5,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStep, setVerificationStep] = useState<'enter_code' | 'verify'>('enter_code');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/security/settings');
      const result: ApiResponse<SecuritySettings> = response.data;

      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async (newSettings: Partial<SecuritySettings>) => {
    try {
      setSaving(true);
      setError(null);

      const response = await api.patch('/security/settings', newSettings);
      const result: ApiResponse<SecuritySettings> = response.data;

      if (result.success && result.data) {
        setSettings(result.data);
        onSettingsChanged?.(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Toggle 2FA
  const handleToggle2FA = async () => {
    if (!settings.twoFactorEnabled) {
      // Initiate 2FA setup
      setShow2FASetup(true);
      // In production, fetch QR code from server
      setQrCodeUrl('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yMCAyMGgxNnYxNmgtMTZ6bTAtOGgxNnYxNmgtMTZ6bTAtOGgxNnYxNmgtMTZ6bTAtOGgxNnYxNmgtMTZ6bTE2IDIwaDE2djE2aC0xNnptMC04aDE2djE2aC0xNnptMC04aDE2djE2aC0xNnptMC04aDE2djE2aC0xNnptOC0xNmgtMTZ2MTZoMTZ6bTAgOGgxNnYtMTZoLTE2em0wIDhoMTZ2MTZoLTE2em0wIDhoMTZ2MTZoLTE2em0wIDhoMTZ2MTZoLTE2eiIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==');
      setSecret('JBSWY3DPEHPK3PXP');
    } else {
      // Disable 2FA
      await handleSave({ twoFactorEnabled: false, twoFactorMethod: undefined });
    }
  };

  // Verify 2FA code
  const handleVerify2FA = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.post('/security/2fa/verify', {
        code: verificationCode,
      });

      setVerificationStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setSaving(false);
    }
  };

  // Complete 2FA setup
  const handleComplete2FASetup = async () => {
    await handleSave({
      twoFactorEnabled: true,
      twoFactorMethod: 'app',
    });
    setShow2FASetup(false);
    setVerificationCode('');
    setVerificationStep('enter_code');
  };

  // Toggle biometric
  const handleToggleBiometric = async () => {
    // In production, trigger biometric enrollment flow
    await handleSave({ biometricEnabled: !settings.biometricEnabled });
  };

  // Toggle notifications
  const handleToggle = async (key: keyof SecuritySettings) => {
    const newValue = !settings[key];
    await handleSave({ [key]: newValue } as Partial<SecuritySettings>);
  };

  // Session timeout options
  const sessionTimeoutOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 480, label: '8 hours' },
  ];

  if (loading) {
    return (
      <div className="security-settings">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
        <style>{`.security-settings { padding: 16px; }`}</style>
      </div>
    );
  }

  if (error && !settings.twoFactorEnabled) {
    return (
      <div className="security-settings">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSettings}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
        <style>{`.security-settings { padding: 16px; }`}</style>
      </div>
    );
  }

  return (
    <div className="security-settings">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account security and authentication preferences.
        </p>
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {verificationStep === 'enter_code' ? (
              <>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Set Up Two-Factor Authentication
                  </h3>
                  <p className="text-sm text-gray-500">
                    Scan this QR code with your authenticator app:
                  </p>
                </div>

                <div className="flex justify-center mb-6">
                  {qrCodeUrl && (
                    <img
                      src={qrCodeUrl}
                      alt="2FA QR Code"
                      className="w-48 h-48 border border-gray-200 rounded-lg"
                    />
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manual Entry Code
                  </label>
                  <code className="block bg-gray-100 p-2 rounded text-sm font-mono">
                    {secret}
                  </code>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShow2FASetup(false);
                      setVerificationCode('');
                      setError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerify2FA}
                    disabled={verificationCode.length !== 6 || saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    2FA Enabled Successfully!
                  </h3>
                  <p className="text-sm text-gray-500">
                    Your account is now more secure. You&apos;ll need your authenticator code to log in.
                  </p>
                </div>

                <button
                  onClick={handleComplete2FASetup}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2FA Section */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Two-Factor Authentication
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Authenticator App</h4>
              <p className="text-sm text-gray-500 mt-1">
                Use an authenticator app to generate verification codes.
              </p>
              {settings.twoFactorEnabled && settings.twoFactorMethod && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Enabled via {settings.twoFactorMethod}
                </p>
              )}
            </div>
            <button
              onClick={handleToggle2FA}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Biometric Section */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-1.466.946-3.193.946-5.132V5a1 1 0 00-1-1H8a1 1 0 00-1 1v2.132c0 1.939.301 3.666.946 5.132m3.839 1.132a21.88 21.88 0 00-.946-5.132m-3.839 1.132a21.88 21.88 0 00-3.839 5.132" />
          </svg>
          Biometric Authentication
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Use Biometrics to Login</h4>
              <p className="text-sm text-gray-500 mt-1">
                Enable Face ID, Touch ID, or fingerprint for quick and secure login.
              </p>
            </div>
            <button
              onClick={handleToggleBiometric}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.biometricEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Security Notifications
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Login Notifications</h4>
              <p className="text-sm text-gray-500">Get notified when someone logs into your account</p>
            </div>
            <button
              onClick={() => handleToggle('loginNotifications')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.loginNotifications ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.loginNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">New Device Alerts</h4>
              <p className="text-sm text-gray-500">Alert when logging in from a new device</p>
            </div>
            <button
              onClick={() => handleToggle('newDeviceAlerts')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.newDeviceAlerts ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.newDeviceAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">New Location Alerts</h4>
              <p className="text-sm text-gray-500">Alert when logging in from a new location</p>
            </div>
            <button
              onClick={() => handleToggle('newLocationAlerts')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.newLocationAlerts ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.newLocationAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Session Settings */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Session Timeout
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="block mb-2">
            <span className="text-sm font-medium text-gray-700">Auto-logout after inactivity</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Sessions will automatically end after this period of inactivity.
            </p>
          </label>
          <select
            value={settings.sessionTimeout}
            onChange={e => handleSave({ sessionTimeout: parseInt(e.target.value) })}
            disabled={saving}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {sessionTimeoutOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <style>{`
        .security-settings {
          padding: 16px;
        }
      `}</style>
    </div>
  );
};

export default SecuritySettings;

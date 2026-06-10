import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Smartphone,
  Key,
  Shield,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Monitor,
  Clock,
  LogOut,
  Download,
  Trash2,
  FileText,
  Loader2,
  X,
  QrCode,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

interface LoginSession {
  sessionId: string;
  device: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface TwoFactorStatus {
  enabled: boolean;
  backupEnabled: boolean;
  hasRecoveryCodes: boolean;
  lastVerified?: string;
}

interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
  recoveryCodes: string[];
}

const ProfileSecurity: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // 2FA State
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [settingUp2FA, setSettingUp2FA] = useState(false);

  // Fetch login history
  useEffect(() => {
    fetchLoginHistory();
    fetch2FAStatus();
  }, []);

  const fetchLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/auth/login-history');
      if (response.data.success) {
        setLoginHistory(response.data.data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch login history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetch2FAStatus = async () => {
    try {
      const response = await api.get('/auth/2fa/status');
      if (response.data.success) {
        setTwoFactorStatus(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    }
  };

  const handleSetup2FA = async () => {
    setSettingUp2FA(true);
    try {
      const response = await api.post('/auth/2fa/setup');
      if (response.data.success) {
        setTwoFactorSetup(response.data.data);
        setShowSetup2FA(true);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to setup 2FA' });
    } finally {
      setSettingUp2FA(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verifyCode) {
      setMessage({ type: 'error', text: 'Please enter the verification code' });
      return;
    }

    setSettingUp2FA(true);
    try {
      const response = await api.post('/auth/2fa/enable', { code: verifyCode });
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Two-factor authentication enabled successfully!' });
        setShowSetup2FA(false);
        setVerifyCode('');
        setTwoFactorSetup(null);
        fetch2FAStatus();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to enable 2FA' });
    } finally {
      setSettingUp2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setMessage({ type: 'error', text: 'Please enter your password to disable 2FA' });
      return;
    }

    if (!verifyCode) {
      setMessage({ type: 'error', text: 'Please enter a verification code' });
      return;
    }

    setSettingUp2FA(true);
    try {
      const response = await api.post('/auth/2fa/disable', {
        code: verifyCode,
        password: disablePassword
      });
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Two-factor authentication disabled' });
        fetch2FAStatus();
        setVerifyCode('');
        setDisablePassword('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disable 2FA' });
    } finally {
      setSettingUp2FA(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!confirm('Are you sure you want to logout from all other devices? Your current session will remain active.')) {
      return;
    }

    setLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all-devices');
      setMessage({ type: 'success', text: 'Successfully logged out from all other devices' });
      fetchLoginHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to logout from other devices' });
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleLogoutSession = async (login: LoginSession) => {
    if (!confirm(`Are you sure you want to logout from "${login.device || 'this device'}"?`)) {
      return;
    }

    try {
      await api.delete(`/sessions/${login.sessionId}`);
      setMessage({ type: 'success', text: 'Session logged out successfully' });
      fetchLoginHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to logout from this device' });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSavePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 12) {
      setMessage({ type: 'error', text: 'Password must be at least 12 characters' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setIsEditingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to change password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditingPassword(false);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage(null);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const response = await api.get('/auth/export-data');
      if (response.data.success) {
        // Create downloadable JSON file
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nilin-user-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setMessage({ type: 'success', text: 'Your data has been downloaded!' });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to export data',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Please enter your password to confirm' });
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await api.delete('/auth/account', {
        data: { password: deletePassword },
      });

      if (response.data.success) {
        setShowDeleteModal(false);
        // Logout and redirect
        await logout();
        navigate('/');
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete account. Please check your password.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Section */}
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Password</h3>
            <p className="text-sm text-nilin-warmGray">Update your password to keep your account secure</p>
          </div>
        </div>

        {!isEditingPassword ? (
          <button
            onClick={() => setIsEditingPassword(true)}
            className="btn-nilin"
          >
            Change Password
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-12 pr-12 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-12 pr-12 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-nilin-warmGray mt-1">Must be at least 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-12 pr-12 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSavePassword}
                disabled={isLoading}
                className="btn-nilin flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-nilin-coral" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-nilin-charcoal">Two-Factor Authentication</h3>
            <p className="text-sm text-nilin-warmGray">Add an extra layer of security</p>
          </div>
          {twoFactorStatus?.enabled ? (
            <span className="badge-nilin-primary">Enabled</span>
          ) : (
            <span className="badge-nilin">Disabled</span>
          )}
        </div>

        {twoFactorStatus?.enabled ? (
          <div className="space-y-4">
            <p className="text-sm text-nilin-warmGray">
              Your account is protected with two-factor authentication.
            </p>
            <div className="flex gap-3">
              {showSetup2FA ? (
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-nilin-charcoal font-medium">Scan this QR code with your authenticator app:</p>
                  {twoFactorSetup?.qrCodeUrl && (
                    <div className="flex justify-center">
                      <img src={twoFactorSetup.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Manual entry code:</label>
                    <code className="block bg-nilin-muted p-2 rounded text-sm font-mono">{twoFactorSetup?.secret}</code>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Enter verification code:</label>
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-center font-mono text-lg tracking-widest"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleEnable2FA}
                      disabled={settingUp2FA || verifyCode.length !== 6}
                      className="btn-nilin flex-1"
                    >
                      {settingUp2FA ? 'Verifying...' : 'Verify & Enable'}
                    </button>
                    <button
                      onClick={() => {
                        setShowSetup2FA(false);
                        setTwoFactorSetup(null);
                        setVerifyCode('');
                      }}
                      className="px-4 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowSetup2FA(true)}
                    className="px-4 py-2 rounded-nilin border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Disable 2FA
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-nilin-warmGray">
              2FA adds an additional security step when logging in. You'll need an authenticator app like Google Authenticator or Authy.
            </p>
            <button
              onClick={handleSetup2FA}
              disabled={settingUp2FA}
              className="btn-nilin flex items-center gap-2"
            >
              {settingUp2FA ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  Enable Two-Factor Authentication
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-nilin flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </span>
        </div>
      )}

      {/* Login History */}
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Login History</h3>
            <p className="text-sm text-nilin-warmGray">Devices where your account was used</p>
          </div>
        </div>

        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-nilin-coral" />
            </div>
          ) : loginHistory.length === 0 ? (
            <p className="text-nilin-warmGray text-sm text-center py-4">No login history available</p>
          ) : (
            loginHistory.map((login, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-nilin-muted flex items-center justify-center">
                    {login.device?.includes('iPhone') || login.device?.includes('Android') || login.device?.includes('Mobile') ? (
                      <Smartphone className="w-5 h-5 text-nilin-warmGray" />
                    ) : (
                      <Monitor className="w-5 h-5 text-nilin-warmGray" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-nilin-charcoal text-sm">{login.device || 'Unknown Device'}</p>
                      {login.isCurrent && (
                        <span className="badge-nilin-primary text-xs">Current</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                      {login.browser && <span>{login.browser}</span>}
                      {login.os && <span>on {login.os}</span>}
                      {login.ip && <span>• IP: {login.ip}</span>}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(login.lastActive)}
                      </span>
                    </div>
                  </div>
                </div>
                {!login.isCurrent && (
                  <button
                    onClick={() => handleLogoutSession(login)}
                    className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-nilin-coral" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-nilin-charcoal">Active Sessions</h3>
              <p className="text-sm text-nilin-warmGray">Manage devices logged into your account</p>
            </div>
          </div>
          <button
            onClick={handleLogoutAllDevices}
            disabled={loggingOutAll}
            className="text-sm text-nilin-coral hover:text-nilin-rose flex items-center gap-2 disabled:opacity-50"
          >
            {loggingOutAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                Logout All Devices
              </>
            )}
          </button>
        </div>
      </div>

      {/* Data & Account Actions */}
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Data & Account</h3>
            <p className="text-sm text-nilin-warmGray">Manage your account data and settings</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Download My Data */}
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full text-left px-4 py-4 rounded-nilin border border-nilin-border hover:bg-nilin-muted transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-nilin-coral" />
              <div>
                <p className="font-medium text-nilin-charcoal">Download My Data</p>
                <p className="text-xs text-nilin-warmGray">Export all your account data as JSON</p>
              </div>
            </div>
            {isExporting ? (
              <div className="w-5 h-5 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
            )}
          </button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-left px-4 py-4 rounded-nilin border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-600">Delete Account</p>
                <p className="text-xs text-red-400">Permanently delete your account and data</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">Delete Account</h3>
              <p className="text-nilin-warmGray text-sm">
                Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none"
                placeholder="Your password"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
                className="flex-1 py-3 rounded-nilin bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Chevron icon helper
const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default ProfileSecurity;

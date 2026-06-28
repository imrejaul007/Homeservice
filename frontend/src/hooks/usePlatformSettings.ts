import { useState, useEffect, useCallback, useRef } from 'react';
import { useToastActions } from '../components/common/Toast';
import { adminMaintenanceApi } from '../services/adminMaintenanceApi';
import { adminSettingsApi } from '../services/adminSettingsApi';
import {
  DEFAULT_PLATFORM_SETTINGS,
  parseSettingsSection,
  type PlatformSettings,
  type SettingsSection,
} from '../types/platformSettings';

export function usePlatformSettings() {
  const toast = useToastActions();
  const importInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    parseSettingsSection(window.location.search)
  );
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<Awaited<ReturnType<typeof adminSettingsApi.getHistory>>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [templateModal, setTemplateModal] = useState({
    isOpen: false,
    templateId: null as string | null,
    subject: '',
    body: '',
    hoursBefore: 24,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const merged = await adminSettingsApi.get();
      setSettings(merged);
      setOriginalSettings(merged);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toastRef.current.error('Failed to load settings', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
  }, [settings, originalSettings]);

  useEffect(() => {
    const onPopState = () => setActiveSection(parseSettingsSection(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSectionChange = useCallback((section: SettingsSection) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set('section', section);
    window.history.pushState({}, '', url.pathname + url.search);
  }, []);

  const handleSettingChange = useCallback(<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleEmailConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: { ...prev.emailConfig, [field]: value },
    }));
  }, []);

  const handleSmtpConfigChange = useCallback((field: string, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: {
        ...prev.emailConfig,
        smtp: { ...prev.emailConfig.smtp!, [field]: value },
      },
    }));
  }, []);

  const handleSesConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: {
        ...prev.emailConfig,
        ses: { ...prev.emailConfig.ses!, [field]: value },
      },
    }));
  }, []);

  const handleSendgridConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: {
        ...prev.emailConfig,
        sendgrid: { ...prev.emailConfig.sendgrid!, [field]: value },
      },
    }));
  }, []);

  const handleResendConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: {
        ...prev.emailConfig,
        resend: { ...prev.emailConfig.resend!, [field]: value },
      },
    }));
  }, []);

  const handleSmsConfigChange = useCallback((field: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: { ...prev.smsConfig, [field]: value },
    }));
  }, []);

  const handleTwilioConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        twilio: { ...prev.smsConfig.twilio!, [field]: value },
      },
    }));
  }, []);

  const handleVonageConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        vonage: { ...(prev.smsConfig.vonage || { apiKey: '', apiSecret: '', fromNumber: '' }), [field]: value },
      },
    }));
  }, []);

  const handleMsg91ConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        msg91: { ...(prev.smsConfig.msg91 || { authKey: '', templateId: '', senderId: '' }), [field]: value },
      },
    }));
  }, []);

  const syncMaintenanceIfNeeded = useCallback(
    async (saved: PlatformSettings) => {
      const maintenanceChanged =
        saved.maintenanceMode !== originalSettings.maintenanceMode ||
        saved.maintenanceMessage !== originalSettings.maintenanceMessage ||
        saved.maintenanceEstimatedDuration !== originalSettings.maintenanceEstimatedDuration;

      if (!maintenanceChanged) return;

      try {
        await adminMaintenanceApi.update({
          enabled: saved.maintenanceMode,
          message:
            saved.maintenanceMessage ||
            'The platform is currently under maintenance. Please try again later.',
          estimatedDuration: saved.maintenanceEstimatedDuration || undefined,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Maintenance page may be out of sync';
        toast.error('Maintenance sync warning', { description: message });
      }
    },
    [originalSettings, toast]
  );

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await adminSettingsApi.saveDiff(settings, originalSettings);
      await syncMaintenanceIfNeeded(saved);
      setSettings(saved);
      setOriginalSettings(saved);
      toast.success('Settings saved successfully', 'Your changes have been applied');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to save settings', { description: message });
    } finally {
      setIsSaving(false);
    }
  }, [settings, originalSettings, syncMaintenanceIfNeeded, toast]);

  const resetSettings = useCallback(async () => {
    setIsResetting(true);
    setShowResetConfirm(false);
    try {
      const reset = await adminSettingsApi.reset();
      setSettings(reset);
      setOriginalSettings(reset);
      toast.success('Settings reset to defaults', 'All platform settings have been restored');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to reset settings', { description: message });
    } finally {
      setIsResetting(false);
    }
  }, [toast]);

  const revertChanges = useCallback(() => {
    setSettings(originalSettings);
    toast.info('Changes reverted', 'Unsaved edits were discarded');
  }, [originalSettings, toast]);

  const handleAddIpAddress = useCallback(() => {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([a-fA-F0-9:]+)$/;
    if (!ipRegex.test(newIpAddress)) {
      toast.error('Invalid IP address', { description: 'Please enter a valid IP address' });
      return;
    }
    if (settings.ipAllowlist.includes(newIpAddress)) {
      toast.error('IP already exists', { description: 'This IP address is already in the allowlist' });
      return;
    }
    handleSettingChange('ipAllowlist', [...settings.ipAllowlist, newIpAddress]);
    setNewIpAddress('');
    toast.success('IP added', 'IP address added to allowlist');
  }, [newIpAddress, settings.ipAllowlist, handleSettingChange, toast]);

  const handleRemoveIpAddress = useCallback(
    (ip: string) => {
      handleSettingChange(
        'ipAllowlist',
        settings.ipAllowlist.filter((i) => i !== ip)
      );
      toast.success('IP removed', 'IP address removed from allowlist');
    },
    [settings.ipAllowlist, handleSettingChange, toast]
  );

  const handleTemplateToggle = useCallback((templateId: string) => {
    setSettings((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [templateId]: {
          ...prev.emailTemplates[templateId],
          enabled: !prev.emailTemplates[templateId]?.enabled,
        },
      },
    }));
  }, []);

  const openTemplateEditor = useCallback(
    (templateId: string) => {
      const template = settings.emailTemplates[templateId];
      setTemplateModal({
        isOpen: true,
        templateId,
        subject: template?.subject || '',
        body: template?.body || '',
        hoursBefore: template?.hoursBefore ?? 24,
      });
    },
    [settings.emailTemplates]
  );

  const closeTemplateEditor = useCallback(() => {
    setTemplateModal({ isOpen: false, templateId: null, subject: '', body: '', hoursBefore: 24 });
  }, []);

  const saveTemplate = useCallback(() => {
    if (!templateModal.templateId) return;
    setSettings((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [templateModal.templateId!]: {
          ...prev.emailTemplates[templateModal.templateId!],
          subject: templateModal.subject,
          body: templateModal.body,
          ...(templateModal.templateId === 'bookingReminder'
            ? { hoursBefore: templateModal.hoursBefore }
            : {}),
        },
      },
    }));
    closeTemplateEditor();
    toast.success('Template updated', 'Save platform settings to persist this template');
  }, [templateModal, closeTemplateEditor, toast]);

  const handleTestEmail = useCallback(async () => {
    if (!testEmail.includes('@')) {
      toast.error('Invalid email', { description: 'Please enter a valid email address' });
      return;
    }
    setIsTestingEmail(true);
    try {
      await adminSettingsApi.testEmail(testEmail);
      toast.success('Test email sent', `Email sent to ${testEmail}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to send test email', { description: message });
    } finally {
      setIsTestingEmail(false);
    }
  }, [testEmail, toast]);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
        toast.error('Invalid file type', { description: 'Please upload a JPEG, PNG, GIF, or WebP image' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large', { description: 'Logo must be less than 5MB' });
        return;
      }
      setIsUploading(true);
      try {
        const logoUrl = await adminSettingsApi.uploadLogo(file);
        handleSettingChange('platformLogo', logoUrl);
        toast.success('Logo uploaded', 'Your logo has been updated');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Please try again';
        toast.error('Failed to upload logo', { description: message });
      } finally {
        setIsUploading(false);
      }
    },
    [handleSettingChange, toast]
  );

  const handleLogoDelete = useCallback(async () => {
    try {
      const updated = await adminSettingsApi.deleteLogo();
      setSettings(updated);
      setOriginalSettings(updated);
      toast.success('Logo removed', 'Platform logo has been deleted');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to delete logo', { description: message });
    }
  }, [toast]);

  const handleExportSettings = useCallback(async () => {
    try {
      const payload = await adminSettingsApi.export();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Settings exported', 'Your settings have been downloaded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to export settings', { description: message });
    }
  }, [toast]);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          const imported = await adminSettingsApi.import(jsonData);
          setSettings(imported);
          setOriginalSettings(imported);
          toast.success('Settings imported', 'Your settings have been restored from the file');
        } catch {
          toast.error('Invalid file', { description: 'The selected file is not a valid settings file' });
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [toast]
  );

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const entries = await adminSettingsApi.getHistory(25);
      setHistoryEntries(entries);
      setShowHistory(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      toast.error('Failed to load history', { description: message });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [toast]);

  const sectionProps = {
    settings,
    onChange: handleSettingChange,
    onEmailConfigChange: handleEmailConfigChange,
    onSmtpConfigChange: handleSmtpConfigChange,
    onSesConfigChange: handleSesConfigChange,
    onSendgridConfigChange: handleSendgridConfigChange,
    onResendConfigChange: handleResendConfigChange,
    onSmsConfigChange: handleSmsConfigChange,
    onTwilioConfigChange: handleTwilioConfigChange,
    onVonageConfigChange: handleVonageConfigChange,
    onMsg91ConfigChange: handleMsg91ConfigChange,
  };

  return {
    activeSection,
    handleSectionChange,
    settings,
    originalSettings,
    isLoading,
    isSaving,
    isResetting,
    hasChanges,
    showResetConfirm,
    setShowResetConfirm,
    showHistory,
    setShowHistory,
    historyEntries,
    isLoadingHistory,
    templateModal,
    setTemplateModal,
    isUploading,
    isDragging,
    setIsDragging,
    testEmail,
    setTestEmail,
    isTestingEmail,
    newIpAddress,
    setNewIpAddress,
    importInputRef,
    fileInputRef,
    fetchSettings,
    saveSettings,
    resetSettings,
    revertChanges,
    handleAddIpAddress,
    handleRemoveIpAddress,
    handleTemplateToggle,
    openTemplateEditor,
    closeTemplateEditor,
    saveTemplate,
    handleTestEmail,
    handleLogoUpload,
    handleLogoDelete,
    handleExportSettings,
    handleImportClick,
    handleImportFileSelect,
    loadHistory,
    sectionProps,
  };
}

export type PlatformSettingsController = ReturnType<typeof usePlatformSettings>;

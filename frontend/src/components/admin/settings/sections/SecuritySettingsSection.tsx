import React from 'react';
import { ExternalLink, Key, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { NumberInput, SectionDivider, SettingRow, TextInput, ToggleSwitch } from '../SettingsPrimitives';

type Props = SettingsSectionProps & {
  newIpAddress: string;
  setNewIpAddress: (v: string) => void;
  onAddIp: () => void;
  onRemoveIp: (ip: string) => void;
};

export const SecuritySettingsSection: React.FC<Props> = ({
  settings,
  onChange,
  newIpAddress,
  setNewIpAddress,
  onAddIp,
  onRemoveIp,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-1">
      <SectionDivider label="Authentication" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Require 2FA" description="Mandatory two-factor authentication for all users">
          <ToggleSwitch enabled={settings.require2FA} onChange={(v) => onChange('require2FA', v)} />
        </SettingRow>
        <SettingRow label="Session Timeout" description="Minutes before inactive session expires">
          <NumberInput value={settings.sessionTimeoutMinutes} onChange={(v) => onChange('sessionTimeoutMinutes', v)} min={15} max={1440} step={5} suffix="min" />
        </SettingRow>
      </div>

      <SectionDivider label="Password Policy" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Minimum Password Length" description="Minimum characters required for passwords">
          <NumberInput value={settings.passwordMinLength} onChange={(v) => onChange('passwordMinLength', v)} min={6} max={128} suffix="chars" />
        </SettingRow>
        <SettingRow label="Require Special Characters" description="Password must contain special characters">
          <ToggleSwitch enabled={settings.passwordRequireSpecialChar} onChange={(v) => onChange('passwordRequireSpecialChar', v)} />
        </SettingRow>
        <SettingRow label="Require Numbers" description="Password must contain at least one number">
          <ToggleSwitch enabled={settings.passwordRequireNumber} onChange={(v) => onChange('passwordRequireNumber', v)} />
        </SettingRow>
        <SettingRow label="Require Uppercase" description="Password must contain uppercase letters">
          <ToggleSwitch enabled={settings.passwordRequireUppercase} onChange={(v) => onChange('passwordRequireUppercase', v)} />
        </SettingRow>
        <SettingRow label="Max Login Attempts" description="Failed attempts before account lockout">
          <NumberInput value={settings.maxLoginAttempts} onChange={(v) => onChange('maxLoginAttempts', v)} min={3} max={20} suffix="attempts" />
        </SettingRow>
        <SettingRow label="Lockout Duration" description="Account lockout duration in minutes">
          <NumberInput value={settings.lockoutDurationMinutes} onChange={(v) => onChange('lockoutDurationMinutes', v)} min={5} max={1440} suffix="min" />
        </SettingRow>
      </div>

      <SectionDivider label="Platform Features" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Enable FAQ" description="Show FAQ/help section on the platform">
          <ToggleSwitch enabled={settings.enableFAQ} onChange={(v) => onChange('enableFAQ', v)} />
        </SettingRow>
        <SettingRow label="Enable Audit Logs" description="Track and log all admin actions">
          <ToggleSwitch enabled={settings.enableAuditLogs} onChange={(v) => onChange('enableAuditLogs', v)} />
        </SettingRow>
      </div>

      <SectionDivider label="IP Allowlist" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
        <p className="text-xs text-nilin-warmGray font-sans">Restrict admin panel access to specific IP addresses. Leave empty to allow all.</p>
        <div className="flex gap-2">
          <TextInput value={newIpAddress} onChange={setNewIpAddress} placeholder="e.g., 192.168.1.1" className="flex-1" />
          <button type="button" onClick={onAddIp} className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm">
            <Plus className="h-4 w-4 mr-1" /> Add
          </button>
        </div>
        {settings.ipAllowlist.map((ip) => (
          <div key={ip} className="flex items-center justify-between p-3 bg-nilin-blush/20 rounded-lg">
            <span className="text-sm font-mono">{ip}</span>
            <button type="button" onClick={() => onRemoveIp(ip)} className="p-1 text-red-500 hover:bg-red-50 rounded">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <SectionDivider label="Integration API Keys" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-xs text-nilin-warmGray font-sans">Manage integration keys with permissions and rate limits.</p>
        <button
          type="button"
          onClick={() => navigate('/admin/api-keys')}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm"
        >
          <Key className="h-4 w-4 mr-2" />
          Open API Key Management
          <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-80" />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, SettingRow, TextInput, ToggleSwitch } from '../SettingsPrimitives';

export const GeneralSettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-1">
      <SectionDivider label="Platform Identity" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Platform Name" description="The display name for your platform">
          <TextInput value={settings.platformName} onChange={(v) => onChange('platformName', v)} placeholder="Enter platform name" />
        </SettingRow>
        <SettingRow label="Platform Logo URL" description="URL to your platform logo (or upload in Branding)">
          <TextInput
            value={settings.platformLogo}
            onChange={(v) => onChange('platformLogo', v)}
            type="url"
            placeholder="https://example.com/logo.png"
          />
        </SettingRow>
      </div>

      <SectionDivider label="Regional Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Currency" description="Default currency for pricing">
          <select
            value={settings.currency}
            onChange={(e) => onChange('currency', e.target.value)}
            className="w-32 px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm text-nilin-charcoal font-sans"
          >
            {['USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CNY', 'JPY', 'CAD', 'AUD'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Date Format" description="Format for displaying dates">
          <select
            value={settings.dateFormat}
            onChange={(e) => onChange('dateFormat', e.target.value)}
            className="w-40 px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </SettingRow>
        <SettingRow label="Language" description="Default platform language">
          <select
            value={settings.language}
            onChange={(e) => onChange('language', e.target.value)}
            className="w-40 px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </SettingRow>
      </div>

      <SectionDivider label="Support Contact" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Support Email" description="Email address for customer support">
          <TextInput value={settings.supportEmail} onChange={(v) => onChange('supportEmail', v)} type="email" />
        </SettingRow>
        <SettingRow label="Support Phone" description="Phone number for customer support">
          <TextInput value={settings.supportPhone} onChange={(v) => onChange('supportPhone', v)} />
        </SettingRow>
      </div>

      <SectionDivider label="Maintenance" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Maintenance Mode"
          description="When enabled, only admins can access the platform"
          warning={settings.maintenanceMode}
        >
          <ToggleSwitch enabled={settings.maintenanceMode} onChange={(v) => onChange('maintenanceMode', v)} />
        </SettingRow>
        {settings.maintenanceMode && (
          <>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">Maintenance Message</label>
              <textarea
                value={settings.maintenanceMessage}
                onChange={(e) => onChange('maintenanceMessage', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans resize-none"
              />
            </div>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">Estimated Duration</label>
              <TextInput
                value={settings.maintenanceEstimatedDuration}
                onChange={(v) => onChange('maintenanceEstimatedDuration', v)}
                placeholder="e.g., 2 hours"
              />
            </div>
          </>
        )}
        <div className="p-4 border-t border-nilin-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-nilin-warmGray font-sans">
            For scheduled maintenance windows, banners, and public status, use the dedicated maintenance console.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin/maintenance')}
            className="inline-flex items-center justify-center px-4 py-2 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
          >
            Open Maintenance Console
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

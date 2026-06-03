import React from 'react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { NumberInput, SectionDivider, SettingRow, TextInput } from '../SettingsPrimitives';

export const SystemSettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  const fileTypesText = settings.allowedFileTypes.join(', ');

  return (
    <div className="space-y-1">
      <SectionDivider label="Performance" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Cache TTL" description="Time in seconds to cache API responses">
          <NumberInput value={settings.cacheTTLSeconds} onChange={(v) => onChange('cacheTTLSeconds', v)} min={60} max={86400} step={60} suffix="sec" />
        </SettingRow>
      </div>

      <SectionDivider label="Rate Limiting" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Requests Per Minute" description="Maximum requests per minute per user">
          <NumberInput value={settings.rateLimitRequestsPerMinute} onChange={(v) => onChange('rateLimitRequestsPerMinute', v)} min={10} max={10000} suffix="req/min" />
        </SettingRow>
        <SettingRow label="API Rate Limit Per Hour" description="Maximum API calls per hour">
          <NumberInput value={settings.apiRateLimitPerHour} onChange={(v) => onChange('apiRateLimitPerHour', v)} min={100} max={100000} suffix="req/hr" />
        </SettingRow>
      </div>

      <SectionDivider label="File Uploads" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
        <SettingRow label="Max Upload Size" description="Maximum file size for user uploads">
          <NumberInput value={settings.maxFileUploadSizeMB} onChange={(v) => onChange('maxFileUploadSizeMB', v)} min={1} max={100} suffix="MB" />
        </SettingRow>
        <div>
          <label className="block text-sm font-medium mb-1.5 font-sans">Allowed MIME Types</label>
          <TextInput
            value={fileTypesText}
            onChange={(v) =>
              onChange(
                'allowedFileTypes',
                v.split(',').map((s) => s.trim()).filter(Boolean)
              )
            }
            placeholder="image/jpeg, image/png, application/pdf"
          />
          <p className="text-xs text-nilin-warmGray mt-1 font-sans">Comma-separated list of MIME types</p>
        </div>
      </div>
    </div>
  );
};

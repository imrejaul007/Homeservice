import React from 'react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, SettingRow, ToggleSwitch } from '../SettingsPrimitives';

export const NotificationsSettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => (
  <div className="space-y-1">
    <SectionDivider label="Notification Channels" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Email Notifications" description="Send notifications via email">
        <ToggleSwitch enabled={settings.emailNotificationsEnabled} onChange={(v) => onChange('emailNotificationsEnabled', v)} />
      </SettingRow>
      <SettingRow label="SMS Notifications" description="Send notifications via SMS">
        <ToggleSwitch enabled={settings.smsNotificationsEnabled} onChange={(v) => onChange('smsNotificationsEnabled', v)} />
      </SettingRow>
      <SettingRow label="Push Notifications" description="Send push notifications to mobile apps">
        <ToggleSwitch enabled={settings.pushNotificationsEnabled} onChange={(v) => onChange('pushNotificationsEnabled', v)} />
      </SettingRow>
    </div>

    <SectionDivider label="Sound Settings" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Notification Sounds" description="Play sounds for notifications">
        <ToggleSwitch enabled={settings.notificationSounds} onChange={(v) => onChange('notificationSounds', v)} />
      </SettingRow>
    </div>

    <SectionDivider label="Quiet Hours" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Enable Quiet Hours" description="Pause notifications during specified hours">
        <ToggleSwitch enabled={settings.quietHoursEnabled} onChange={(v) => onChange('quietHoursEnabled', v)} />
      </SettingRow>
      {settings.quietHoursEnabled && (
        <>
          <div className="p-4 border-t border-nilin-border/30">
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">Start Time</label>
            <input
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) => onChange('quietHoursStart', e.target.value)}
              className="w-full px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
            />
          </div>
          <div className="p-4 border-t border-nilin-border/30">
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">End Time</label>
            <input
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) => onChange('quietHoursEnd', e.target.value)}
              className="w-full px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
            />
          </div>
        </>
      )}
    </div>
  </div>
);

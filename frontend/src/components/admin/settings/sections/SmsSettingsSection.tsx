import React from 'react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, SelectInput, SettingRow, TextInput, ToggleSwitch } from '../SettingsPrimitives';

export const SmsSettingsSection: React.FC<SettingsSectionProps> = ({
  settings,
  onSmsConfigChange,
  onTwilioConfigChange,
  onVonageConfigChange,
  onMsg91ConfigChange,
}) => (
  <div className="space-y-1">
    <SectionDivider label="SMS Configuration" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
      <SettingRow label="Enable SMS" description="Send SMS notifications to users">
        <ToggleSwitch enabled={settings.smsConfig.enabled} onChange={(v) => onSmsConfigChange('enabled', v)} />
      </SettingRow>
      <div>
        <label className="block text-sm font-medium mb-1.5 font-sans">SMS Provider</label>
        <SelectInput
          value={settings.smsConfig.provider}
          onChange={(v) => onSmsConfigChange('provider', v)}
          disabled={!settings.smsConfig.enabled}
          options={[
            { value: 'twilio', label: 'Twilio' },
            { value: 'vonage', label: 'Vonage' },
            { value: 'msg91', label: 'MSG91' },
          ]}
        />
      </div>
    </div>

    {settings.smsConfig.provider === 'twilio' && (
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
        <SectionDivider label="Twilio Credentials" />
        <TextInput
          value={settings.smsConfig.twilio?.accountSid || ''}
          onChange={(v) => onTwilioConfigChange('accountSid', v)}
          placeholder="Account SID"
          disabled={!settings.smsConfig.enabled}
        />
        <TextInput
          value={settings.smsConfig.twilio?.authToken || ''}
          onChange={(v) => onTwilioConfigChange('authToken', v)}
          type="password"
          placeholder="Leave blank to keep existing"
          disabled={!settings.smsConfig.enabled}
        />
        <TextInput
          value={settings.smsConfig.twilio?.fromNumber || ''}
          onChange={(v) => onTwilioConfigChange('fromNumber', v)}
          placeholder="+1234567890"
          disabled={!settings.smsConfig.enabled}
        />
      </div>
    )}

    {settings.smsConfig.provider === 'vonage' && (
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
        <SectionDivider label="Vonage Credentials" />
        <TextInput value={settings.smsConfig.vonage?.apiKey || ''} onChange={(v) => onVonageConfigChange('apiKey', v)} disabled={!settings.smsConfig.enabled} />
        <TextInput
          value={settings.smsConfig.vonage?.apiSecret || ''}
          onChange={(v) => onVonageConfigChange('apiSecret', v)}
          type="password"
          placeholder="Leave blank to keep existing"
          disabled={!settings.smsConfig.enabled}
        />
        <TextInput value={settings.smsConfig.vonage?.fromNumber || ''} onChange={(v) => onVonageConfigChange('fromNumber', v)} disabled={!settings.smsConfig.enabled} />
      </div>
    )}

    {settings.smsConfig.provider === 'msg91' && (
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
        <SectionDivider label="MSG91 Credentials" />
        <TextInput
          value={settings.smsConfig.msg91?.authKey || ''}
          onChange={(v) => onMsg91ConfigChange('authKey', v)}
          type="password"
          placeholder="Leave blank to keep existing"
          disabled={!settings.smsConfig.enabled}
        />
        <TextInput value={settings.smsConfig.msg91?.templateId || ''} onChange={(v) => onMsg91ConfigChange('templateId', v)} disabled={!settings.smsConfig.enabled} />
        <TextInput value={settings.smsConfig.msg91?.senderId || ''} onChange={(v) => onMsg91ConfigChange('senderId', v)} disabled={!settings.smsConfig.enabled} />
      </div>
    )}
  </div>
);

import React from 'react';
import { Loader2, Send } from 'lucide-react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, SelectInput, TextInput, ToggleSwitch } from '../SettingsPrimitives';

type Props = SettingsSectionProps & {
  testEmail: string;
  setTestEmail: (v: string) => void;
  isTestingEmail: boolean;
  onTestEmail: () => void;
};

export const EmailSettingsSection: React.FC<Props> = ({
  settings,
  onEmailConfigChange,
  onSmtpConfigChange,
  onSesConfigChange,
  onSendgridConfigChange,
  onResendConfigChange,
  testEmail,
  setTestEmail,
  isTestingEmail,
  onTestEmail,
}) => (
  <div className="space-y-1">
    <SectionDivider label="Email Provider" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4">
      <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">Email Provider</label>
      <SelectInput
        value={settings.emailConfig.provider}
        onChange={(value) => onEmailConfigChange('provider', value)}
        options={[
          { value: 'smtp', label: 'SMTP' },
          { value: 'resend', label: 'Resend' },
          { value: 'ses', label: 'Amazon SES' },
          { value: 'sendgrid', label: 'SendGrid' },
        ]}
      />
      {(settings.emailConfig.provider === 'ses' || settings.emailConfig.provider === 'sendgrid') && (
        <p className="text-xs text-amber-700 mt-2 font-sans">
          {settings.emailConfig.provider === 'ses' ? 'Amazon SES' : 'SendGrid'} is not fully wired yet. Use SMTP or Resend for test sends.
        </p>
      )}
      <p className="text-xs text-nilin-charcoal/60 mt-2 font-sans">
        Send Test uses saved credentials from this page (not only server env vars).
      </p>
    </div>

    {settings.emailConfig.provider === 'smtp' && (
      <>
        <SectionDivider label="SMTP Configuration" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 font-sans">SMTP Host</label>
              <TextInput value={settings.emailConfig.smtp?.host || ''} onChange={(v) => onSmtpConfigChange('host', v)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 font-sans">Port</label>
              <TextInput
                value={String(settings.emailConfig.smtp?.port || 587)}
                onChange={(v) => onSmtpConfigChange('port', parseInt(v, 10) || 587)}
                type="number"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium font-sans">SSL/TLS (Secure)</span>
            <ToggleSwitch
              enabled={settings.emailConfig.smtp?.secure || false}
              onChange={(v) => onSmtpConfigChange('secure', v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 font-sans">Username</label>
            <TextInput value={settings.emailConfig.smtp?.user || ''} onChange={(v) => onSmtpConfigChange('user', v)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 font-sans">Password</label>
            <TextInput
              value={settings.emailConfig.smtp?.pass || ''}
              onChange={(v) => onSmtpConfigChange('pass', v)}
              type="password"
              placeholder="Leave blank to keep existing"
            />
          </div>
        </div>
      </>
    )}

    {settings.emailConfig.provider === 'resend' && (
      <>
        <SectionDivider label="Resend API" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4">
          <label className="block text-sm font-medium mb-1.5 font-sans">API Key</label>
          <TextInput
            value={settings.emailConfig.resend?.apiKey || ''}
            onChange={(v) => onResendConfigChange('apiKey', v)}
            type="password"
            placeholder="re_..."
          />
        </div>
      </>
    )}

    {settings.emailConfig.provider === 'sendgrid' && (
      <>
        <SectionDivider label="SendGrid API" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4">
          <label className="block text-sm font-medium mb-1.5 font-sans">API Key</label>
          <TextInput
            value={settings.emailConfig.sendgrid?.apiKey || ''}
            onChange={(v) => onSendgridConfigChange('apiKey', v)}
            type="password"
            placeholder="SG...."
          />
        </div>
      </>
    )}

    {settings.emailConfig.provider === 'ses' && (
      <>
        <SectionDivider label="Amazon SES" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 font-sans">Access Key ID</label>
            <TextInput value={settings.emailConfig.ses?.accessKeyId || ''} onChange={(v) => onSesConfigChange('accessKeyId', v)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 font-sans">Secret Access Key</label>
            <TextInput
              value={settings.emailConfig.ses?.secretAccessKey || ''}
              onChange={(v) => onSesConfigChange('secretAccessKey', v)}
              type="password"
              placeholder="Leave blank to keep existing"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 font-sans">Region</label>
            <TextInput value={settings.emailConfig.ses?.region || 'us-east-1'} onChange={(v) => onSesConfigChange('region', v)} />
          </div>
        </div>
      </>
    )}

    <SectionDivider label="Sender Information" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 font-sans">From Email</label>
        <TextInput value={settings.emailConfig.fromEmail} onChange={(v) => onEmailConfigChange('fromEmail', v)} type="email" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 font-sans">From Name</label>
        <TextInput value={settings.emailConfig.fromName} onChange={(v) => onEmailConfigChange('fromName', v)} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 font-sans">Reply-To Email</label>
        <TextInput value={settings.emailConfig.replyToEmail} onChange={(v) => onEmailConfigChange('replyToEmail', v)} type="email" />
      </div>
    </div>

    <SectionDivider label="Test Configuration" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1.5 font-sans">Test Email Address</label>
          <TextInput value={testEmail} onChange={setTestEmail} type="email" placeholder="test@example.com" />
        </div>
        <button
          type="button"
          onClick={onTestEmail}
          disabled={isTestingEmail || !testEmail}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {isTestingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test
        </button>
      </div>
    </div>
  </div>
);

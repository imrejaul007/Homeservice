import React from 'react';
import { AlertTriangle, Download, History, RotateCcw, Upload } from 'lucide-react';
import type { PlatformSettings } from '../../../../types/platformSettings';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { NumberInput, SectionDivider, SettingRow, ToggleSwitch } from '../SettingsPrimitives';

type Props = SettingsSectionProps & {
  importInputRef: React.RefObject<HTMLInputElement>;
  onExport: () => void;
  onImportClick: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetClick: () => void;
  onViewHistory: () => void;
  isLoadingHistory: boolean;
};

export const BackupSettingsSection: React.FC<Props> = ({
  settings,
  onChange,
  importInputRef,
  onExport,
  onImportClick,
  onImportFile,
  onResetClick,
  onViewHistory,
  isLoadingHistory,
}) => (
  <div className="space-y-1">
    <SectionDivider label="Cloud Backup" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      <SettingRow label="Enable Automatic Backup" description="Nightly backup at 2:00 AM (Asia/Dubai). Local JSON files are always kept; S3 upload requires AWS env vars.">
        <ToggleSwitch enabled={settings.backupEnabled} onChange={(v) => onChange('backupEnabled', v)} />
      </SettingRow>
      {settings.backupLastRunAt && (
        <div className="px-4 py-3 border-t border-nilin-border/30 text-sm text-nilin-charcoal/80 font-sans">
          Last backup: {new Date(settings.backupLastRunAt).toLocaleString()}
        </div>
      )}
      {settings.backupEnabled && (
        <>
          <div className="p-4 border-t border-nilin-border/30">
            <label className="block text-sm font-medium mb-1.5 font-sans">Cloud Storage Provider</label>
            <select
              value={settings.backupCloudStorage}
              onChange={(e) => onChange('backupCloudStorage', e.target.value as PlatformSettings['backupCloudStorage'])}
              className="w-full px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans"
            >
              <option value="none">Local only</option>
              <option value="aws">AWS S3</option>
              <option value="gcp">Google Cloud</option>
              <option value="azure">Azure Blob</option>
            </select>
            <p className="text-xs text-nilin-charcoal/60 mt-2 font-sans">
              S3: set AWS_S3_BACKUP_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in server env.
            </p>
          </div>
          <div className="p-4 border-t border-nilin-border/30">
            <label className="block text-sm font-medium mb-1.5 font-sans">Retention Period</label>
            <NumberInput value={settings.backupRetentionDays} onChange={(v) => onChange('backupRetentionDays', v)} min={1} max={365} suffix="days" />
          </div>
        </>
      )}
    </div>

    <SectionDivider label="Export & Import" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-6 space-y-4">
      <button type="button" onClick={onExport} className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm">
        <Download className="h-4 w-4 mr-2" /> Export Settings
      </button>
      <button type="button" onClick={onImportClick} className="inline-flex items-center px-4 py-2 border rounded-xl text-sm ml-3">
        <Upload className="h-4 w-4 mr-2" /> Import Settings
      </button>
      <input ref={importInputRef} type="file" accept=".json" onChange={onImportFile} className="hidden" />
      <p className="text-xs text-amber-600 flex items-center gap-1 font-sans">
        <AlertTriangle className="h-3 w-3" /> Import replaces all current settings
      </p>
    </div>

    <SectionDivider label="Audit" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-6 flex flex-wrap gap-3">
      <button type="button" onClick={onViewHistory} disabled={isLoadingHistory} className="inline-flex items-center px-4 py-2 border rounded-xl text-sm">
        <History className="h-4 w-4 mr-2" />
        {isLoadingHistory ? 'Loading...' : 'View Change History'}
      </button>
      <button type="button" onClick={onResetClick} className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-xl text-sm">
        <RotateCcw className="h-4 w-4 mr-2" /> Reset to Defaults
      </button>
    </div>
  </div>
);

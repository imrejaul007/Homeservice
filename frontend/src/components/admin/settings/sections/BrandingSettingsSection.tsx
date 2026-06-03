import React from 'react';
import { AlertCircle, Loader2, Trash2, Upload } from 'lucide-react';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, TextInput } from '../SettingsPrimitives';

type Props = SettingsSectionProps & {
  isUploading: boolean;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDeleteLogo: () => void;
};

export const BrandingSettingsSection: React.FC<Props> = ({
  settings,
  onChange,
  isUploading,
  isDragging,
  setIsDragging,
  fileInputRef,
  onFileSelect,
  onDrop,
  onDeleteLogo,
}) => (
  <div className="space-y-1">
    <SectionDivider label="Platform Logo" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-6">
      {settings.platformLogo ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center p-8 bg-white rounded-xl border">
            <img src={settings.platformLogo} alt="Platform Logo" className="max-h-32 object-contain" />
          </div>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border rounded-xl text-sm">
              Replace
            </button>
            <button type="button" onClick={onDeleteLogo} className="px-4 py-2 text-red-600 border border-red-200 rounded-xl text-sm flex items-center">
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center ${isDragging ? 'border-nilin-coral bg-nilin-blush/30' : 'border-nilin-border'}`}
        >
          <Upload className="h-8 w-8 mx-auto text-nilin-coral mb-2" />
          <p className="text-sm text-nilin-warmGray font-sans mb-2">JPEG, PNG, GIF, WebP (max 5MB)</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Choose File'}
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={onFileSelect} className="hidden" />
    </div>

    <SectionDivider label="Favicon" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-4">
      <label className="block text-sm font-medium mb-1.5 font-sans">Favicon URL</label>
      <TextInput value={settings.favicon} onChange={(v) => onChange('favicon', v)} type="url" placeholder="https://example.com/favicon.ico" />
      {settings.favicon && (
        <div className="mt-3 flex items-center gap-2 text-xs text-nilin-warmGray">
          <AlertCircle className="h-3.5 w-3.5" />
          Preview in browser after save
        </div>
      )}
    </div>

    <SectionDivider label="Brand Colors" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
      {(['primaryColor', 'secondaryColor'] as const).map((key) => (
        <div key={key} className="flex items-center justify-between py-4 px-4 border-t border-nilin-border/30 first:border-t-0">
          <span className="text-sm font-medium capitalize font-sans">{key === 'primaryColor' ? 'Primary Color' : 'Secondary Color'}</span>
          <div className="flex items-center gap-2">
            <input type="color" value={settings[key]} onChange={(e) => onChange(key, e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer border" />
            <TextInput value={settings[key]} onChange={(v) => onChange(key, v)} className="w-28" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

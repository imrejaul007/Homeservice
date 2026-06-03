import React from 'react';
import { Edit3, X } from 'lucide-react';
import { EMAIL_TEMPLATES_CONFIG } from '../../../../types/platformSettings';
import type { SettingsSectionProps } from '../settingsSectionTypes';
import { SectionDivider, TextInput, ToggleSwitch } from '../SettingsPrimitives';

type Props = SettingsSectionProps & {
  templateModal: {
    isOpen: boolean;
    templateId: string | null;
    subject: string;
    body: string;
    hoursBefore: number;
  };
  setTemplateModal: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      templateId: string | null;
      subject: string;
      body: string;
      hoursBefore: number;
    }>
  >;
  onToggle: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onCloseEditor: () => void;
  onSaveTemplate: () => void;
};

export const TemplatesSettingsSection: React.FC<Props> = ({
  settings,
  templateModal,
  setTemplateModal,
  onToggle,
  onOpenEditor,
  onCloseEditor,
  onSaveTemplate,
}) => (
  <div className="space-y-1">
    <SectionDivider label="Email Templates" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden divide-y divide-nilin-border/30">
      {EMAIL_TEMPLATES_CONFIG.map((template) => {
        const templateData = settings.emailTemplates[template.id] || { subject: '', body: '', enabled: true };
        return (
          <div key={template.id} className="flex items-center justify-between p-4 hover:bg-nilin-blush/30">
            <div className="flex-1 mr-4">
              <span className="text-sm font-medium text-nilin-charcoal font-sans">{template.name}</span>
              <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">{template.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch enabled={templateData.enabled} onChange={() => onToggle(template.id)} />
              <button type="button" onClick={() => onOpenEditor(template.id)} className="p-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg">
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>

    <SectionDivider label="Available Variables" />
    <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-4">
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set(EMAIL_TEMPLATES_CONFIG.flatMap((t) => t.variables))).map((variable) => (
          <span key={variable} className="px-2 py-1 bg-nilin-blush/50 text-nilin-coral text-xs rounded-lg font-mono">
            {variable}
          </span>
        ))}
      </div>
    </div>

    {templateModal.isOpen && (
      <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="glass glass-blur rounded-2xl max-w-2xl w-full shadow-nilin-lg max-h-[90vh] flex flex-col">
          <div className="p-6 border-b border-nilin-border/50 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-serif text-nilin-charcoal">
                {EMAIL_TEMPLATES_CONFIG.find((t) => t.id === templateModal.templateId)?.name}
              </h3>
            </div>
            <button type="button" onClick={onCloseEditor}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 font-sans">Subject</label>
              <TextInput value={templateModal.subject} onChange={(v) => setTemplateModal((p) => ({ ...p, subject: v }))} />
            </div>
            {templateModal.templateId === 'bookingReminder' && (
              <div>
                <label className="block text-sm font-medium mb-1.5 font-sans">Hours Before Appointment</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={templateModal.hoursBefore}
                  onChange={(e) => setTemplateModal((p) => ({ ...p, hoursBefore: parseInt(e.target.value, 10) || 24 }))}
                  className="w-24 px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5 font-sans">Body</label>
              <textarea
                value={templateModal.body}
                onChange={(e) => setTemplateModal((p) => ({ ...p, body: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl bg-white text-sm font-sans resize-none"
              />
            </div>
          </div>
          <div className="p-6 border-t border-nilin-border/50 flex justify-end gap-3">
            <button type="button" onClick={onCloseEditor} className="px-4 py-2 border rounded-xl text-sm">
              Cancel
            </button>
            <button type="button" onClick={onSaveTemplate} className="px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm">
              Save Template
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

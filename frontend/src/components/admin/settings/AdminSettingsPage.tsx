import React from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  X,
} from 'lucide-react';
import PageLayout from '../../layout/PageLayout';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { SETTINGS_SECTIONS } from '../../../types/platformSettings';
import { SettingsSectionRouter } from './SettingsSectionRouter';

const AdminSettingsPage: React.FC = () => {
  const ctrl = usePlatformSettings();
  const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === ctrl.activeSection);
  const SectionIcon = activeMeta?.icon || Settings;

  return (
    <PageLayout
      title="Settings"
      subtitle="Platform configuration"
      backHref="/admin/dashboard"
      headerActions={
        <div className="flex items-center space-x-3">
          {ctrl.hasChanges && (
            <button
              type="button"
              onClick={ctrl.revertChanges}
              disabled={ctrl.isSaving}
              className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={() => ctrl.setShowResetConfirm(true)}
            disabled={ctrl.isResetting || ctrl.isSaving}
            className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 disabled:opacity-50"
          >
            {ctrl.isResetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Reset
          </button>
          <button
            type="button"
            onClick={ctrl.fetchSettings}
            disabled={ctrl.isLoading || ctrl.isSaving || ctrl.isResetting}
            className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${ctrl.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={ctrl.saveSettings}
            disabled={!ctrl.hasChanges || ctrl.isSaving || ctrl.isResetting}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-nilin-rose to-nilin-coral disabled:opacity-50"
          >
            {ctrl.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </button>
        </div>
      }
    >
      {ctrl.settings.maintenanceMode && (
        <div className="mb-6 rounded-xl p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-amber-800 font-sans">Maintenance Mode Active</h3>
              <p className="text-sm mt-1 text-amber-700 font-sans">
                Only administrators can access the site. Customers and providers see the maintenance page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => ctrl.sectionProps.onChange('maintenanceMode', false)}
              className="ml-3 p-1 text-amber-500 hover:text-amber-700"
              title="Disable maintenance mode"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {ctrl.showResetConfirm && (
        <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass glass-blur rounded-2xl max-w-md w-full shadow-nilin-lg inner-glow p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal text-center mb-2">Reset Settings?</h3>
            <p className="text-sm text-nilin-warmGray text-center mb-6 font-sans">
              This restores all platform settings to defaults. Export first if you need a backup.
            </p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => ctrl.setShowResetConfirm(false)} className="px-4 py-2 border rounded-xl text-sm">
                Cancel
              </button>
              <button type="button" onClick={ctrl.resetSettings} disabled={ctrl.isResetting} className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm flex items-center">
                {ctrl.isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset All Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {ctrl.showHistory && (
        <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass glass-blur rounded-2xl max-w-lg w-full shadow-nilin-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-serif text-nilin-charcoal">Settings Change History</h3>
              <button type="button" onClick={() => ctrl.setShowHistory(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {ctrl.historyEntries.length === 0 ? (
                <p className="text-sm text-nilin-warmGray font-sans">No history entries yet.</p>
              ) : (
                ctrl.historyEntries.map((entry, i) => (
                  <div key={i} className="p-3 rounded-lg bg-nilin-blush/20 text-xs font-sans">
                    <p className="font-medium text-nilin-charcoal">{entry.reason || 'Settings updated'}</p>
                    <p className="text-nilin-warmGray mt-1">
                      {entry.changedAt || entry.updatedAt
                        ? new Date(String(entry.changedAt || entry.updatedAt)).toLocaleString()
                        : '—'}
                    </p>
                    {entry.changes && (
                      <p className="mt-1 text-nilin-warmGray">Fields: {entry.changes.join(', ')}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 flex-shrink-0">
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden sticky top-6">
            <div className="p-2">
              <h3 className="px-3 py-2 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                Settings Sections
              </h3>
              <nav className="space-y-1">
                {SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = ctrl.activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => ctrl.handleSectionChange(section.id)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium font-sans transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-md'
                          : 'text-nilin-charcoal hover:bg-nilin-blush/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mr-3 ${isActive ? '' : 'text-nilin-coral'}`} />
                      {section.label}
                      {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                    </button>
                  );
                })}
              </nav>
            </div>
            {ctrl.hasChanges && (
              <div className="p-4 border-t border-nilin-border/50 bg-nilin-blush/20">
                <div className="flex items-center text-sm text-nilin-coral font-sans">
                  <div className="w-2 h-2 rounded-full bg-nilin-coral mr-2 animate-pulse" />
                  Unsaved changes
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="px-6 py-4 border-b border-nilin-border/50 bg-gradient-to-r from-nilin-blush/30 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-nilin-coral/20 flex items-center justify-center">
                  <SectionIcon className="h-5 w-5 text-nilin-coral" />
                </div>
                <div>
                  <h2 className="text-lg font-serif text-nilin-charcoal">{activeMeta?.label} Settings</h2>
                  <p className="text-xs text-nilin-warmGray font-sans">
                    Configure {activeMeta?.label?.toLowerCase()} options for your platform
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <SettingsSectionRouter section={ctrl.activeSection} ctrl={ctrl} />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminSettingsPage;

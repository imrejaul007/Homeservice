import React from 'react';
import type { PlatformSettingsController } from '../../../hooks/usePlatformSettings';
import type { SettingsSection } from '../../../types/platformSettings';
import { LoadingSkeleton } from './SettingsPrimitives';
import { BackupSettingsSection } from './sections/BackupSettingsSection';
import { BookingSettingsSection } from './sections/BookingSettingsSection';
import { BrandingSettingsSection } from './sections/BrandingSettingsSection';
import { EmailSettingsSection } from './sections/EmailSettingsSection';
import { FeesSettingsSection } from './sections/FeesSettingsSection';
import { GeneralSettingsSection } from './sections/GeneralSettingsSection';
import { NotificationsSettingsSection } from './sections/NotificationsSettingsSection';
import { SecuritySettingsSection } from './sections/SecuritySettingsSection';
import { SmsSettingsSection } from './sections/SmsSettingsSection';
import { SystemSettingsSection } from './sections/SystemSettingsSection';
import { TemplatesSettingsSection } from './sections/TemplatesSettingsSection';

interface Props {
  section: SettingsSection;
  ctrl: PlatformSettingsController;
}

export const SettingsSectionRouter: React.FC<Props> = ({ section, ctrl }) => {
  if (ctrl.isLoading) {
    return <LoadingSkeleton />;
  }

  const { sectionProps } = ctrl;

  switch (section) {
    case 'general':
      return <GeneralSettingsSection {...sectionProps} />;
    case 'fees':
      return <FeesSettingsSection {...sectionProps} />;
    case 'booking':
      return <BookingSettingsSection {...sectionProps} />;
    case 'notifications':
      return <NotificationsSettingsSection {...sectionProps} />;
    case 'email':
      return (
        <EmailSettingsSection
          {...sectionProps}
          testEmail={ctrl.testEmail}
          setTestEmail={ctrl.setTestEmail}
          isTestingEmail={ctrl.isTestingEmail}
          onTestEmail={ctrl.handleTestEmail}
        />
      );
    case 'sms':
      return <SmsSettingsSection {...sectionProps} />;
    case 'templates':
      return (
        <TemplatesSettingsSection
          {...sectionProps}
          templateModal={ctrl.templateModal}
          setTemplateModal={ctrl.setTemplateModal}
          onToggle={ctrl.handleTemplateToggle}
          onOpenEditor={ctrl.openTemplateEditor}
          onCloseEditor={ctrl.closeTemplateEditor}
          onSaveTemplate={ctrl.saveTemplate}
        />
      );
    case 'branding':
      return (
        <BrandingSettingsSection
          {...sectionProps}
          isUploading={ctrl.isUploading}
          isDragging={ctrl.isDragging}
          setIsDragging={ctrl.setIsDragging}
          fileInputRef={ctrl.fileInputRef}
          onFileSelect={(e) => {
            const file = e.target.files?.[0];
            if (file) ctrl.handleLogoUpload(file);
          }}
          onDrop={(e) => {
            e.preventDefault();
            ctrl.setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) ctrl.handleLogoUpload(file);
          }}
          onDeleteLogo={ctrl.handleLogoDelete}
        />
      );
    case 'security':
      return (
        <SecuritySettingsSection
          {...sectionProps}
          newIpAddress={ctrl.newIpAddress}
          setNewIpAddress={ctrl.setNewIpAddress}
          onAddIp={ctrl.handleAddIpAddress}
          onRemoveIp={ctrl.handleRemoveIpAddress}
        />
      );
    case 'backup':
      return (
        <BackupSettingsSection
          {...sectionProps}
          importInputRef={ctrl.importInputRef}
          onExport={ctrl.handleExportSettings}
          onImportClick={ctrl.handleImportClick}
          onImportFile={ctrl.handleImportFileSelect}
          onResetClick={() => ctrl.setShowResetConfirm(true)}
          onViewHistory={ctrl.loadHistory}
          isLoadingHistory={ctrl.isLoadingHistory}
        />
      );
    case 'system':
      return <SystemSettingsSection {...sectionProps} />;
    default:
      return null;
  }
};

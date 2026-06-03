import type { PlatformSettings } from '../../../types/platformSettings';

export interface SettingsSectionProps {
  settings: PlatformSettings;
  onChange: <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => void;
  onEmailConfigChange: (field: string, value: string) => void;
  onSmtpConfigChange: (field: string, value: string | number | boolean) => void;
  onSesConfigChange: (field: string, value: string) => void;
  onSendgridConfigChange: (field: string, value: string) => void;
  onResendConfigChange: (field: string, value: string) => void;
  onSmsConfigChange: (field: string, value: string | boolean) => void;
  onTwilioConfigChange: (field: string, value: string) => void;
  onVonageConfigChange: (field: string, value: string) => void;
  onMsg91ConfigChange: (field: string, value: string) => void;
}
